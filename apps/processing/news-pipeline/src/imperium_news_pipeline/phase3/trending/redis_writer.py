"""Redis writer for trending results.

Writes trending scores to Redis sorted sets and metadata to hashes.
Uses pipelined commands for efficiency.

Key patterns (per PRD §15):
  trend:global:1h                   → ZADD score "term"
  trend:country:{country_name}:1h   → ZADD score "term"
  trend:topic:{topic_label}:1h      → ZADD score "term"
  trend:meta:{scope_key}:{term_key} → HSET metadata

All keys TTL = 7200 seconds (2 hours).
"""
from __future__ import annotations

import logging
import re
from typing import Any, Dict, List

import redis

from imperium_news_pipeline.phase3.trending.retry import retry

logger = logging.getLogger("TrendingRedisWriter")

TREND_TTL_SECONDS = 7200  # 2 hours

# Sanitise Redis key segments to prevent injection via crafted scope values.
_RE_UNSAFE_KEY = re.compile(r"[^a-zA-Z0-9_\-.\u0600-\u06FF\u0750-\u077F\u00C0-\u024F]")


def _safe_key_segment(value: str) -> str:
    """Replace unsafe characters in a Redis key segment with underscores."""
    return _RE_UNSAFE_KEY.sub("_", value.strip().lower()) if value else "unknown"


@retry(max_attempts=3, base_delay=1.0, retryable=(redis.ConnectionError, redis.TimeoutError))
def write_trends_to_redis(
    redis_client: redis.Redis,
    trends: List[Dict[str, Any]],
    top_n_global: int = 100,
    top_n_country: int = 50,
    top_n_topic: int = 50,
    top_n_country_topic: int = 50,
    top_n_global_topic: int = 50,
) -> int:
    """Write a batch of trend records to Redis.

    Each trend dict must contain:
      scope_type, scope_value, term, term_type, current_count,
      previous_count, velocity, score, window_end (ISO string)

    Returns the number of terms written.
    """
    if not trends:
        return 0

    pipe = redis_client.pipeline(transaction=False)
    zset_keys: set[str] = set()
    written = 0

    for t in trends:
        scope_type = t["scope_type"]
        scope_value = t["scope_value"]
        term = t["term"]
        score = float(t["score"])

        # Build sorted-set key
        if scope_type == "global":
            zset_key = "trend:global:5h"
        elif scope_type == "country":
            zset_key = f"trend:country:{_safe_key_segment(scope_value)}:5h"
        elif scope_type == "topic":
            zset_key = f"trend:topic:{_safe_key_segment(scope_value)}:5h"
        elif scope_type == "country_topic":
            parts = scope_value.split("|")
            country = parts[0] if len(parts) > 0 else "unknown"
            topic = parts[1] if len(parts) > 1 else "unknown"
            zset_key = f"trend:country_topic:{_safe_key_segment(country)}:{_safe_key_segment(topic)}:5h"
        elif scope_type == "global_topic":
            parts = scope_value.split("|")
            topic = parts[1] if len(parts) > 1 else "unknown"
            zset_key = f"trend:global_topic:global:{_safe_key_segment(topic)}:5h"
        else:
            continue

        pipe.zadd(zset_key, {term: score})
        zset_keys.add(zset_key)

        # Metadata hash
        meta_key = f"trend:meta:{_safe_key_segment(scope_type)}:{_safe_key_segment(scope_value)}:{_safe_key_segment(term)}"
        pipe.hset(meta_key, mapping={
            "term": term,
            "scope_type": scope_type,
            "scope_value": scope_value,
            "term_type": str(t.get("term_type", "")),
            "article_ids": ",".join(t.get("article_ids", [])),
            "current_count": str(t["current_count"]),
            "previous_count": str(t["previous_count"]),
            "velocity": str(t["velocity"]),
            "score": str(score),
            "updated_at": str(t.get("window_end", "")),
        })
        pipe.expire(meta_key, TREND_TTL_SECONDS)
        written += 1

    # Set TTL and trim sorted sets
    for zk in zset_keys:
        pipe.expire(zk, TREND_TTL_SECONDS)
        # Determine scope type from key to choose top_n
        if zk.startswith("trend:global:"):
            limit = top_n_global
        elif zk.startswith("trend:country:"):
            limit = top_n_country
        elif zk.startswith("trend:topic:"):
            limit = top_n_topic
        elif zk.startswith("trend:country_topic:"):
            limit = top_n_country_topic
        elif zk.startswith("trend:global_topic:"):
            limit = top_n_global_topic
        else:
            limit = top_n_topic
        # Keep only top N by score (remove everything below rank -limit from the end)
        # ZREMRANGEBYRANK key 0 -(limit+1) removes all but the top N
        pipe.zremrangebyrank(zk, 0, -(limit + 1))

    pipe.execute()
    logger.info(f"Redis: wrote {written} trend entries across {len(zset_keys)} sorted sets")
    return written
