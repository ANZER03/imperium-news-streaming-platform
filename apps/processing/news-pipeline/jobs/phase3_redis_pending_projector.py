from __future__ import annotations

import json
import os

from pyspark.sql import DataFrame, SparkSession
from pyspark.sql.functions import col

from imperium_news_pipeline.phase3.canonical import canonical_article_from_event
from imperium_news_pipeline.phase3.redis_projection import RedisFeedProjector
from imperium_news_pipeline.phase3.runtime_adapters import build_redis_client
from imperium_news_pipeline.phase3.runtime_config import Phase3RuntimeConfig
from imperium_news_pipeline.phase3.streaming import apply_trigger_options


def process_batch(rows: DataFrame, batch_id: int, projector: RedisFeedProjector) -> None:
    projected = 0
    skipped = 0
    for row in rows.collect():
        event = json.loads(row.value)
        result = projector.project(canonical_article_from_event(event))
        projected += int(result.projected or result.removed or result.updated_topic_feeds)
        if not (result.projected or result.removed or result.updated_topic_feeds):
            skipped += 1
    print(f"phase3-redis-pending-projector batch={batch_id} projected={projected} skipped={skipped}")


def main() -> None:
    config = Phase3RuntimeConfig.from_env()
    spark = SparkSession.builder.appName("phase3-redis-projector").getOrCreate()
    projector = RedisFeedProjector(build_redis_client(config.redis.url))
    raw_reader = (
        spark.readStream.format("kafka")
        .option("kafka.bootstrap.servers", config.kafka.bootstrap_servers)
        .option("subscribe", config.kafka.canonical_topic)
        .option("startingOffsets", os.getenv("PHASE3_STARTING_OFFSETS", "earliest"))
    )
    max_offsets = os.getenv("PHASE3_MAX_OFFSETS_PER_TRIGGER")
    if max_offsets:
        raw_reader = raw_reader.option("maxOffsetsPerTrigger", max_offsets)
    raw = raw_reader.load()
    stream = raw.select(col("key").cast("string").alias("key"), col("value").cast("string").alias("value"))
    writer = stream.writeStream.foreachBatch(lambda rows, batch_id: process_batch(rows, batch_id, projector)).option(
        "checkpointLocation",
        config.checkpoints.for_job("phase3-redis-projector"),
    )
    writer = apply_trigger_options(writer)
    query = writer.start()
    query.awaitTermination()


if __name__ == "__main__":
    main()
