"""Trending Analysis Spark Streaming Driver.

Reads classified articles from ``imperium.news.classified`` (Confluent Avro),
extracts trending keywords/entities using 1-hour windows with 5-minute slide,
and writes results to Redis (live) and Postgres (historical snapshots).

Usage:
  spark-submit --master spark://spark-master:7077 trending_driver.py
"""
from __future__ import annotations

import os
import sys
import logging
import time
from pathlib import Path
from typing import Mapping, Set

from pyspark.sql import DataFrame, SparkSession
from pyspark.sql.functions import col, expr
from pyspark.sql.avro.functions import from_avro

import pycountry
from nltk.corpus import stopwords as nltk_sw
import redis as redis_lib

from imperium_news_pipeline.phase3.streaming import apply_trigger_processing_time
from imperium_news_pipeline.phase3.trending.trending_processor import process_trending_batch

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger("TrendingDriver")

# Avro schema path — relative to jobs/ directory inside the container
_CLASSIFIED_SCHEMA_PATH = (
    Path(__file__).resolve().parent.parent
    / "resources" / "schema" / "classified_article_v1.avsc"
)

_STOPWORDS_DIR = (
    Path(__file__).resolve().parent.parent
    / "resources" / "stopwords"
)


# ---------------------------------------------------------------------------
# Stopword loading
# ---------------------------------------------------------------------------

def load_stopwords() -> dict[str, set[str]]:
    """Build language_code → stopwords set from NLTK corpus using pycountry for auto-mapping."""
    result: dict[str, set[str]] = {}
    
    for nltk_name in nltk_sw.fileids():
        try:
            lang = pycountry.languages.lookup(nltk_name)
            if hasattr(lang, 'alpha_2'):
                result[lang.alpha_2.lower()] = set(nltk_sw.words(nltk_name))
        except LookupError:
            # Fallback search for languages like greek, nepali, slovene
            for lang in pycountry.languages:
                if hasattr(lang, 'name') and nltk_name.lower() in lang.name.lower():
                    if hasattr(lang, 'alpha_2'):
                        result[lang.alpha_2.lower()] = set(nltk_sw.words(nltk_name))
                        break
                        
    # Fallback for unknown languages -> English
    if "unknown" not in result:
        result["unknown"] = result.get("en", set())
        
    logger.info(f"Loaded NLTK stopwords for {len(result)} language codes")
    return result


def load_blocked_terms(stopwords_dir: Path) -> set[str]:
    """Load global blocked terms."""
    path = stopwords_dir / "blocked_terms.txt"
    if not path.exists():
        logger.warning(f"Blocked terms file not found: {path}")
        return set()

    words = set()
    for line in path.read_text(encoding="utf-8").splitlines():
        word = line.strip().lower()
        if word and not word.startswith("#"):
            words.add(word)
    logger.info(f"Loaded {len(words)} blocked terms")
    return words


# ---------------------------------------------------------------------------
# Config helpers
# ---------------------------------------------------------------------------

def _env(key: str, default: str) -> str:
    return os.environ.get(key, default).strip()


def _env_int(key: str, default: int) -> int:
    return int(os.environ.get(key, str(default)))


def _parse_duration_seconds(s: str) -> int:
    """Parse a human duration like '1 hour', '5 minutes', '30 seconds' to seconds."""
    s = s.strip().lower()
    parts = s.split()
    if len(parts) != 2:
        return int(s)
    value = int(parts[0])
    unit = parts[1]
    if unit.startswith("hour"):
        return value * 3600
    if unit.startswith("minute") or unit.startswith("min"):
        return value * 60
    if unit.startswith("second") or unit.startswith("sec"):
        return value
    return value


# ---------------------------------------------------------------------------
# Driver entry point
# ---------------------------------------------------------------------------

def main() -> None:
    logger.info("Initializing Trending Analysis Driver...")

    # Load configuration
    kafka_servers = _env("KAFKA_BOOTSTRAP_SERVERS", "kafka:29092,kafka-broker-2:29092")
    classified_topic = _env("CLASSIFIED_TOPIC", "imperium.news.classified")
    postgres_dsn = _env("POSTGRES_DSN", "postgresql://postgres:postgres@news-source-db:5432/imperium-news-source")
    redis_url = _env("REDIS_URL", "redis://redis:6379/0")
    checkpoint_root = _env("CHECKPOINT_ROOT", "/tmp/imperium/checkpoints/processing")

    starting_offsets = _env("TRENDING_STARTING_OFFSETS", "earliest")
    max_offsets = os.environ.get("TRENDING_MAX_OFFSETS_PER_TRIGGER", "").strip() or None
    trigger_time = os.environ.get("TRENDING_TRIGGER_PROCESSING_TIME", "").strip() or None

    window_size_s = _parse_duration_seconds(_env("TRENDING_WINDOW_SIZE", "1 hour"))
    slide_interval_s = _parse_duration_seconds(_env("TRENDING_SLIDE_INTERVAL", "5 minutes"))
    watermark = _env("TRENDING_WATERMARK", "30 minutes")

    global_min = _env_int("TRENDING_GLOBAL_MIN_COUNT", 5)
    country_min = _env_int("TRENDING_COUNTRY_MIN_COUNT", 3)
    topic_min = _env_int("TRENDING_TOPIC_MIN_COUNT", 3)
    top_n_global = _env_int("TRENDING_GLOBAL_TOP_N", 100)
    top_n_country = _env_int("TRENDING_COUNTRY_TOP_N", 50)
    top_n_topic = _env_int("TRENDING_TOPIC_TOP_N", 50)

    # Load Avro schema
    schema_path = Path(os.getenv("CLASSIFIED_SCHEMA_PATH", str(_CLASSIFIED_SCHEMA_PATH)))
    if not schema_path.exists():
        raise FileNotFoundError(f"Avro schema not found: {schema_path}")
    classified_schema_json = schema_path.read_text()
    logger.info(f"Loaded classified Avro schema from {schema_path}")

    # Load stopwords + blocked terms
    stopwords_dir = Path(os.getenv("STOPWORDS_DIR", str(_STOPWORDS_DIR)))
    stopwords_map = load_stopwords()
    blocked_terms = load_blocked_terms(stopwords_dir)

    # Connect to Redis
    logger.info(f"Connecting to Redis at {redis_url}...")
    redis_client = None
    for attempt in range(10):
        try:
            redis_client = redis_lib.Redis.from_url(redis_url, decode_responses=True)
            redis_client.ping()
            logger.info("Connected to Redis successfully")
            break
        except Exception as e:
            logger.warning(f"Redis connection attempt {attempt + 1}/10 failed: {e}")
            time.sleep(3)
    if redis_client is None:
        raise ConnectionError(f"Could not connect to Redis at {redis_url}")

    # Build Spark session
    spark = (
        SparkSession.builder
        .appName("imperium-trending-driver")
        .config("spark.sql.shuffle.partitions", "4")
        .config("spark.streaming.stopGracefullyOnShutdown", "true")
        .getOrCreate()
    )
    spark.sparkContext.setLogLevel("WARN")

    # Broadcast stopwords map to all workers
    stopwords_map_bc = spark.sparkContext.broadcast(stopwords_map)

    raw_reader = (
        spark.readStream.format("kafka")
        .option("kafka.bootstrap.servers", kafka_servers)
        .option("subscribe", classified_topic)
    )
    if starting_offsets.endswith("h-ago"):
        hours = int(starting_offsets.split("h")[0])
        ts = int((time.time() - hours * 3600) * 1000)
        raw_reader = raw_reader.option("startingTimestamp", str(ts))
        logger.info(f"Using startingTimestamp={ts} ({hours} hours ago)")
    else:
        raw_reader = raw_reader.option("startingOffsets", starting_offsets)
    if max_offsets:
        raw_reader = raw_reader.option("maxOffsetsPerTrigger", max_offsets)

    raw = raw_reader.load()

    # Deserialise Confluent Avro (skip 5-byte magic prefix)
    stream = raw.select(
        col("timestamp").alias("kafka_timestamp"),
        from_avro(expr("substring(value, 6)"), classified_schema_json).alias("v"),
    )

    # Watermark on event time (Kafka message timestamp)
    stream = stream.withColumn(
        "event_time",
        col("kafka_timestamp")
    ).withWatermark("event_time", watermark)

    checkpoint_path = f"{checkpoint_root.rstrip('/')}/trending"

    # foreachBatch processor
    def _process(batch_df: DataFrame, bid: int) -> None:
        process_trending_batch(
            batch_df=batch_df,
            batch_id=bid,
            stopwords_map=stopwords_map_bc.value,
            blocked_terms=blocked_terms,
            postgres_dsn=postgres_dsn,
            redis_client=redis_client,
            window_size_seconds=window_size_s,
            slide_interval_seconds=slide_interval_s,
            global_min_count=global_min,
            country_min_count=country_min,
            topic_min_count=topic_min,
            top_n_global=top_n_global,
            top_n_country=top_n_country,
            top_n_topic=top_n_topic,
        )

    writer = (
        stream.writeStream
        .foreachBatch(_process)
        .option("checkpointLocation", checkpoint_path)
    )

    writer = apply_trigger_processing_time(writer, trigger_time)

    try:
        logger.info(
            f"Starting Trending Streaming Query "
            f"(topic={classified_topic}, window={window_size_s}s, slide={slide_interval_s}s, "
            f"watermark={watermark})..."
        )
        query = writer.start()
        query.awaitTermination()
    except Exception as exc:
        logger.error(f"Trending Streaming FATAL: {exc}", exc_info=True)
        sys.exit(1)
    finally:
        logger.info("Trending Analysis Driver shutting down.")
        if redis_client:
            redis_client.close()
        spark.stop()


if __name__ == "__main__":
    main()
