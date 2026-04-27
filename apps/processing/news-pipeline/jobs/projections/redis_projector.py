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

def process_batch(messages: List[Message], r: redis.Redis, avro_deserializer):
    pipeline = r.pipeline(transaction=False)
    zsets_to_prune = set()
    
    cutoff_score = time.time() - TTL_SECONDS

    canonical_count = 0
    classified_count = 0

    for msg in messages:
        topic = msg.topic()
        
        if topic == CANONICAL_TOPIC:
            data = decode_json(msg)
            if not data: continue
            
            article_id = data.get("article_id")
            if not article_id: continue
            
            # 1. Update news:{id} hash
            hash_key = f"news:{article_id}"
            
            # Map essential fields
            fields = {
                "title": data.get("title", ""),
                "excerpt": data.get("excerpt", ""),
                "image_url": data.get("image_url", ""),
                "source_name": data.get("source_name", ""),
                "source_domain": data.get("source_domain", ""),
                "rubric_title": data.get("rubric_title", ""),
                "country_id": str(data.get("country_id", "")),
                "country_name": data.get("country_name", ""),
                "language_code": data.get("language_code", ""),
                "published_at": str(data.get("published_at", "")),
                "is_video": "1" if data.get("is_video") else "0"
            }
            # Remove empty strings to save space
            fields = {k: v for k, v in fields.items() if v}
            if fields:
                pipeline.hset(hash_key, mapping=fields)
                pipeline.expire(hash_key, TTL_SECONDS)
            
            # 2. Add to Feeds (ZSETs)
            score = parse_iso_or_ts(data.get("published_at") or data.get("crawled_at"))
            
            # Global feed
            global_feed = "feed:global"
            pipeline.zadd(global_feed, {article_id: score})
            zsets_to_prune.add(global_feed)
            
            # Country feed
            country_id = data.get("country_id")
            if country_id:
                country_feed = f"feed:country:{country_id}"
                pipeline.zadd(country_feed, {article_id: score})
                zsets_to_prune.add(country_feed)
            
            canonical_count += 1
            
        elif topic == CLASSIFIED_TOPIC:
            try:
                data = avro_deserializer(msg.value(), None)
                if not data: continue
                
                article_id = data.get("article_id")
                if not article_id: continue
                
                hash_key = f"news:{article_id}"
                
                # Update news:{id} hash with topic fields
                fields = {
                    "root_topic_id": data.get("root_topic_id", ""),
                    "root_topic_label": data.get("root_topic_label", ""),
                    "topic_confidence": str(data.get("topic_confidence", ""))
                }
                fields = {k: v for k, v in fields.items() if v}
                if fields:
                    pipeline.hset(hash_key, mapping=fields)
                    pipeline.expire(hash_key, TTL_SECONDS)
                
                score = parse_iso_or_ts(data.get("published_at") or data.get("classified_at"))
                root_topic_id = data.get("root_topic_id")
                country_id = data.get("country_id")
                
                if root_topic_id:
                    # Topic feed
                    topic_feed = f"feed:topic:{root_topic_id}"
                    pipeline.zadd(topic_feed, {article_id: score})
                    zsets_to_prune.add(topic_feed)
                    
                    # Country+Topic feed
                    if country_id:
                        ct_feed = f"feed:country:{country_id}:topic:{root_topic_id}"
                        pipeline.zadd(ct_feed, {article_id: score})
                        zsets_to_prune.add(ct_feed)
                
                classified_count += 1
            except Exception as e:
                logger.error(f"Failed to decode avro message on {topic}: {e}")

    # Prune old items from modified ZSETs
    for zset_key in zsets_to_prune:
        pipeline.zremrangebyscore(zset_key, "-inf", cutoff_score)

    if canonical_count or classified_count:
        pipeline.execute()
        logger.info(f"Redis pipeline executed: {canonical_count} canonical, {classified_count} classified updates.")

def main():
    bootstrap_servers = os.environ.get("KAFKA_BOOTSTRAP_SERVERS", "kafka:29092")
    schema_registry_url = os.environ.get("SCHEMA_REGISTRY_URL", "http://schema-registry:8081")
    group_id = "imperium-redis-projector-group"
    
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
            batch_size=1000,
            timeout_ms=1.0,
            logger=logger
        )
    finally:
        r.close()

if __name__ == "__main__":
    main()
