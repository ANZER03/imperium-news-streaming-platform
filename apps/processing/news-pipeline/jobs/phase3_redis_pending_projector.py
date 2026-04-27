from __future__ import annotations

import json
import os

from pyspark.sql import DataFrame, SparkSession
from pyspark.sql.functions import col

from imperium_news_pipeline.phase3.canonical import canonical_article_from_event
from imperium_news_pipeline.phase3.redis_projection import RedisFeedProjector
from imperium_news_pipeline.phase3.runtime_adapters import build_redis_client
from imperium_news_pipeline.phase3.runtime_config import Phase3RuntimeConfig
from imperium_news_pipeline.phase3.streaming import apply_trigger_processing_time


def process_batch(rows: DataFrame, batch_id: int, projector: RedisFeedProjector) -> None:
    projected = 0
    skipped = 0
    for row in rows.collect():
        event = json.loads(row.value)
        result = projector.project_cards_and_feeds(canonical_article_from_event(event))
        projected += int(result.projected)
        if not result.projected:
            skipped += 1
    print(f"imperium-redis-cards-feeds batch={batch_id} projected={projected} skipped={skipped}")


def main() -> None:
    env = os.environ
    config = Phase3RuntimeConfig.from_env()
    spark = SparkSession.builder.appName("imperium-redis-driver").getOrCreate()
    projector = RedisFeedProjector(build_redis_client(config.redis.url))
    raw_reader = (
        spark.readStream.format("kafka")
        .option("kafka.bootstrap.servers", config.kafka.bootstrap_servers)
        .option("subscribe", config.kafka.canonical_topic)
        .option("startingOffsets", config.stream_starting_offsets(env, "redis"))
    )
    max_offsets = config.stream_max_offsets_per_trigger(env, "redis")
    if max_offsets:
        raw_reader = raw_reader.option("maxOffsetsPerTrigger", max_offsets)
    raw = raw_reader.load()
    stream = raw.select(col("key").cast("string").alias("key"), col("value").cast("string").alias("value"))
    writer = stream.writeStream.foreachBatch(lambda rows, batch_id: process_batch(rows, batch_id, projector)).option(
        "checkpointLocation",
        config.checkpoints.for_job("imperium-redis-driver"),
    )
    writer = apply_trigger_processing_time(writer, config.stream_trigger_processing_time(env, "redis"))
    query = writer.start()
    query.awaitTermination()


if __name__ == "__main__":
    main()
