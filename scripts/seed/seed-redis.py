#!/usr/bin/env python3
"""
Seed Redis with test user preferences and article feeds for local development.

Usage:
    python scripts/seed/seed-redis.py [--host <host>] [--port <port>]

Environment variables:
    REDIS_HOST   (default localhost)
    REDIS_PORT   (default 46379)
"""

from __future__ import annotations

import argparse
import json
import os
import time

import redis


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Seed Redis with test data")
    parser.add_argument("--host", default=os.environ.get("REDIS_HOST", "localhost"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("REDIS_PORT", 46379)))
    args = parser.parse_args(argv)

    r = redis.Redis(host=args.host, port=args.port, db=0)

    user_id = "user123"
    topic = "science_technology"

    topics_json = json.dumps([topic])
    r.hset(f"user:{user_id}:prefs", "topics", topics_json)
    r.hset(f"user:{user_id}:prefs", "country_id", "1")

    now = int(time.time())
    for i in range(30):
        art_id = f"art_{i}"
        timestamp = now - (i * 100)
        r.zadd(f"feed:topic:{topic}", {art_id: timestamp})
        r.hset(f"news:{art_id}", "title", json.dumps(f"Article Title {i}"))
        r.hset(f"news:{art_id}", "excerpt", json.dumps(f"This is the excerpt for article {i}"))
        r.hset(f"news:{art_id}", "published_at", json.dumps(str(timestamp)))
        r.hset(f"news:{art_id}", "source_name", json.dumps("Imperium News"))
        r.hset(f"news:{art_id}", "root_topic_label", json.dumps("Technology"))

    print(f"Seeded 30 articles for user {user_id} in topic {topic}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
