import os
import time
from datetime import datetime, timezone
from typing import List, Dict, Any, Tuple
from confluent_kafka import Message
import redis

from utils import build_consumer, build_avro_deserializer, consume_microbatches, decode_json, get_logger

logger = get_logger("RedisProjector")

CANONICAL_TOPIC = "imperium.canonical-articles"
CLASSIFIED_TOPIC = "imperium.news.classified"
TTL_SECONDS = 12 * 24 * 60 * 60 # 12 days

def get_redis_client():
    url = os.environ.get("PHASE3_REDIS_URL", "redis://redis:6379/0")
    return redis.Redis.from_url(url, decode_responses=True)

def parse_iso_or_ts(val: Any) -> float:
    """Returns unix timestamp from integer or ISO string."""
    if not val:
        return time.time()
    if isinstance(val, (int, float)):
        # If it's a huge integer (milliseconds), convert to seconds
        if val > 2e10:
            return float(val) / 1000.0
        return float(val)
    if isinstance(val, str):
        try:
            return datetime.fromisoformat(val.replace("Z", "+00:00")).timestamp()
        except ValueError:
            return time.time()
    return time.time()

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
                data = decode_json(msg)
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
                    "published_at":  _safe_str(data.get("published_at")),
                    "is_video":      "1" if data.get("is_video") else "0",
                }

                # Delete the key first to clear any stale wrong-type entry, then re-write
                pipeline.delete(hash_key)
                pipeline.hset(hash_key, mapping=fields)
                pipeline.expire(hash_key, TTL_SECONDS)

                # Feeds
                score = parse_iso_or_ts(data.get("published_at") or data.get("crawled_at"))

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
                pipeline.hset(hash_key, mapping=fields)
                pipeline.expire(hash_key, TTL_SECONDS)

                if root_topic_id:
                    score = parse_iso_or_ts(data.get("published_at") or data.get("classified_at"))
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
    group_id = os.environ.get("PHASE3_KAFKA_GROUP_ID", "imperium-redis-projector-group")
    
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
            batch_size=5000,
            timeout_ms=1.0,
            logger=logger
        )
    finally:
        r.close()

if __name__ == "__main__":
    main()
