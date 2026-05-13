import os
import zlib
import time
from datetime import datetime, timezone
from typing import List, Dict, Any, Tuple
from confluent_kafka import Message
import redis

from utils import build_consumer, build_avro_deserializer, consume_microbatches, decode_json, get_logger

logger = get_logger("RedisProjector")

CANONICAL_TOPIC = "imperium.canonical-articles"
CLASSIFIED_TOPIC = "imperium.news.classified"
TTL_SECONDS = 7 * 24 * 60 * 60  # 7 days from crawled_at
TTL_MIN_SECONDS = 60             # floor: keep at least 1 min even for old articles


def _crawled_at_to_unix(val: Any) -> float:
    """Convert crawled_at (microseconds int, milliseconds int, or ISO string) to unix seconds."""
    if val is None:
        return 0.0
    if isinstance(val, (int, float)):
        v = float(val)
        if v <= 0:
            return 0.0
        if v > 1e15:          # microseconds (16+ digits)
            return v / 1_000_000.0
        if v > 1e12:          # milliseconds (13 digits)
            return v / 1_000.0
        return v              # already seconds
    if isinstance(val, str):
        s = val.strip()
        if not s or s.lower() == "null":
            return 0.0
        try:
            return datetime.fromisoformat(s.replace("Z", "+00:00")).timestamp()
        except ValueError:
            try:
                return _crawled_at_to_unix(float(s))
            except ValueError:
                return 0.0
    return 0.0


def ttl_from_crawled_at(crawled_at: Any) -> int:
    """Remaining TTL in seconds = 7 days - elapsed since crawled_at. Floor: TTL_MIN_SECONDS."""
    try:
        crawled_ts = _crawled_at_to_unix(crawled_at)
        now = time.time()
        if crawled_ts <= 0 or crawled_ts > now + 86400:
            return TTL_SECONDS
        elapsed = now - crawled_ts
        remaining = int(TTL_SECONDS - elapsed)
        return max(remaining, TTL_MIN_SECONDS)
    except Exception:
        return TTL_SECONDS

def get_redis_client():
    url = os.environ.get("REDIS_URL", "redis://redis:6379/0")
    return redis.Redis.from_url(url, decode_responses=True)

def _score_with_tiebreak(base_score: float, article_id: str) -> float:
    """Add a deterministic microsecond offset (1-999) derived from article_id to break score ties."""
    micro = (zlib.crc32(article_id.encode()) % 999) + 1
    return base_score + micro / 1_000_000.0


def parse_iso_or_ts(val: Any) -> float:
    """Returns unix timestamp from integer or ISO string."""
    if val is None:
        return time.time()
    
    if isinstance(val, str):
        val = val.strip()
        if not val or val.lower() == "null":
            return time.time()
        try:
            return datetime.fromisoformat(val.replace("Z", "+00:00")).timestamp()
        except ValueError:
            # If it's a numeric string, convert to float and continue to numeric logic
            try:
                val = float(val)
            except ValueError:
                return time.time()

    if isinstance(val, (int, float)):
        if val > 2e13:       # microseconds → seconds
            return float(val) / 1_000_000.0
        if val > 2e10:       # milliseconds → seconds
            return float(val) / 1000.0
        return float(val)
    
    return time.time()

def get_first_valid(*vals):
    """Returns the first non-None, non-empty, and non-whitespace-only value."""
    for v in vals:
        if v is None:
            continue
        if isinstance(v, str):
            v_strip = v.strip()
            if v_strip and v_strip.lower() != "null":
                return v_strip
            continue
        # For non-strings (int/float), 0 is valid if it's a timestamp (though unlikely)
        # but usually we just care about truthiness for numeric types here
        if v:
            return v
    return None

def is_valid_timestamp(val: Any) -> bool:
    """True if val parses as an ISO date string or a plausible numeric unix ts."""
    if val is None:
        return False
    if isinstance(val, str):
        s = val.strip()
        if not s or s.lower() == "null":
            return False
        try:
            datetime.fromisoformat(s.replace("Z", "+00:00"))
            return True
        except ValueError:
            try:
                val = float(s)
            except ValueError:
                return False
    if isinstance(val, (int, float)):
        # Reject 0/negatives; accept seconds (>= ~2001) or milliseconds
        return val > 1_000_000_000
    return False

def get_first_valid_timestamp(*vals):
    """Returns the first value that parses as a valid timestamp, else None."""
    for v in vals:
        if is_valid_timestamp(v):
            return v.strip() if isinstance(v, str) else v
    return None

def _safe_str(val: Any, default: str = "") -> str:
    """Convert any value to string, returning default for None/missing."""
    if val is None:
        return default
    return str(val)


def process_batch(messages: List[Message], r: redis.Redis, avro_deserializer):
    pipeline = r.pipeline(transaction=False)  # non-transactional: each command executes independently so a single WRONGTYPE error doesn't silently drop the rest
    zsets_to_prune = set()

    cutoff_score = time.time() - TTL_SECONDS

    canonical_count = 0
    classified_count = 0
    skipped_count = 0

    for msg in messages:
        topic = msg.topic()

        if topic == CANONICAL_TOPIC:
            try:
                data = avro_deserializer(msg.value(), None)
                if not data:
                    skipped_count += 1
                    continue

                article_id = data.get("article_id")
                if not article_id:
                    skipped_count += 1
                    continue

                article_id_str = str(article_id)
                hash_key = f"news:{article_id_str}"

                # All fields written unconditionally — absent Avro/JSON fields default to ""
                # country_id defaults to 0 (feeds null-country articles to feed:country:0)
                raw_country_id = data.get("country_id")
                country_id = int(raw_country_id) if raw_country_id is not None else 0

                fields = {
                    "article_id":    article_id_str,
                    "title":         _safe_str(data.get("title")),
                    "excerpt":       _safe_str(data.get("excerpt")),
                    "image_url":     _safe_str(data.get("image_url")),
                    "source_name":   _safe_str(data.get("source_name")),
                    "source_domain": _safe_str(data.get("source_domain")),
                    "rubric_id":     _safe_str(data.get("rubric_id")),
                    "rubric_title":  _safe_str(data.get("rubric_title")),
                    "country_id":    str(country_id),
                    "country_name":  _safe_str(data.get("country_name")),
                    "language_code": _safe_str(data.get("language_code")),
                    "published_at":  _safe_str(get_first_valid_timestamp(data.get("published_at"), data.get("crawled_at"), data.get("processed_at"))),
                    "crawled_at":    _safe_str(data.get("crawled_at")),
                    "processed_at":  _safe_str(data.get("processed_at")),
                    "is_video":      "1" if data.get("is_video") else "0",
                }

                ttl = ttl_from_crawled_at(data.get("crawled_at"))

                # Delete the key first to clear any stale wrong-type entry, then re-write
                pipeline.delete(hash_key)
                pipeline.hset(hash_key, mapping=fields)
                pipeline.expire(hash_key, ttl)

                # Feeds
                score = _score_with_tiebreak(
                    parse_iso_or_ts(get_first_valid_timestamp(data.get("published_at"), data.get("crawled_at"), data.get("processed_at"))),
                    article_id_str
                )

                global_feed = "feed:global"
                pipeline.zadd(global_feed, {article_id_str: score})
                zsets_to_prune.add(global_feed)

                country_feed = f"feed:country:{country_id}"
                pipeline.zadd(country_feed, {article_id_str: score})
                zsets_to_prune.add(country_feed)

                canonical_count += 1

            except Exception as e:
                logger.error(f"Failed to process canonical message: {e}", exc_info=True)
                skipped_count += 1

        elif topic == CLASSIFIED_TOPIC:
            try:
                data = avro_deserializer(msg.value(), None)
                if not data:
                    skipped_count += 1
                    continue

                article_id = data.get("article_id")
                if not article_id:
                    skipped_count += 1
                    continue

                article_id_str = str(article_id)
                hash_key = f"news:{article_id_str}"

                # Avro omits null fields — always use .get() with explicit defaults
                root_topic_id    = data.get("root_topic_id")    # may be absent → None
                root_topic_label = data.get("root_topic_label")  # may be absent → None
                topic_confidence = data.get("topic_confidence")  # may be absent → None
                raw_country_id   = data.get("country_id")        # may be absent → None

                fields = {
                    "article_id":       article_id_str,
                    "root_topic_id":    _safe_str(root_topic_id),
                    "root_topic_label": _safe_str(root_topic_label),
                    "topic_confidence": _safe_str(topic_confidence),
                }
                ttl = ttl_from_crawled_at(data.get("crawled_at"))
                pipeline.hset(hash_key, mapping=fields)
                pipeline.expire(hash_key, ttl)

                if root_topic_id:
                    score = _score_with_tiebreak(
                        parse_iso_or_ts(get_first_valid_timestamp(data.get("published_at"), data.get("crawled_at"), data.get("processed_at"), data.get("classified_at"))),
                        article_id_str
                    )
                    effective_country_id = int(raw_country_id) if raw_country_id is not None else 0

                    topic_feed = f"feed:topic:{root_topic_id}"
                    pipeline.zadd(topic_feed, {article_id_str: score})
                    zsets_to_prune.add(topic_feed)

                    ct_feed = f"feed:country:{effective_country_id}:topic:{root_topic_id}"
                    pipeline.zadd(ct_feed, {article_id_str: score})
                    zsets_to_prune.add(ct_feed)

                classified_count += 1

            except Exception as e:
                logger.error(f"Failed to process classified message: {e}", exc_info=True)
                skipped_count += 1

    # Prune old items from modified ZSETs
    for zset_key in zsets_to_prune:
        pipeline.zremrangebyscore(zset_key, "-inf", cutoff_score)

    if canonical_count or classified_count:
        pipeline.execute()
        logger.info(
            f"Redis pipeline executed: {canonical_count} canonical, "
            f"{classified_count} classified, {skipped_count} skipped."
        )

def main():
    bootstrap_servers = os.environ.get("KAFKA_BOOTSTRAP_SERVERS", "kafka:29092")
    schema_registry_url = os.environ.get("SCHEMA_REGISTRY_URL", "http://schema-registry:8081")
    group_id = os.environ.get("KAFKA_GROUP_ID", "imperium-redis-projector-group")
    
    logger.info("Initializing Redis Projector...")
    consumer = build_consumer(bootstrap_servers, group_id)
    avro_deserializer = build_avro_deserializer(schema_registry_url)
    
    while True:
        try:
            r = get_redis_client()
            r.ping()
            logger.info("Connected to Redis successfully.")
            break
        except Exception as e:
            logger.warning(f"Waiting for Redis... ({e})")
            time.sleep(5)
            
    def batch_processor(messages: List[Message]):
        process_batch(messages, r, avro_deserializer)
        
    try:
        consume_microbatches(
            consumer=consumer,
            topics=[CANONICAL_TOPIC, CLASSIFIED_TOPIC],
            process_batch=batch_processor,
            batch_size=20000,
            timeout_ms=1.0,
            logger=logger
        )
    finally:
        r.close()

if __name__ == "__main__":
    main()
