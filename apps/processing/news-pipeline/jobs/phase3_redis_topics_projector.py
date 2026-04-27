from __future__ import annotations

import json
import os

from pyspark.sql import DataFrame, SparkSession
from pyspark.sql.functions import col

from imperium_news_pipeline.phase3.canonical import canonical_article_from_event
from imperium_news_pipeline.phase3.projection_state import ProjectionState
from imperium_news_pipeline.phase3.redis_projection import RedisFeedProjector
from imperium_news_pipeline.phase3.runtime_adapters import (
    PostgresProjectionStateRepository,
    _postgres_connection_factory,
    build_redis_client,
)
from imperium_news_pipeline.phase3.runtime_config import Phase3RuntimeConfig
from imperium_news_pipeline.phase3.streaming import apply_trigger_processing_time


def process_batch(
    rows: DataFrame,
    batch_id: int,
    projector: RedisFeedProjector,
    projection_state: PostgresProjectionStateRepository,
) -> None:
    projected = 0
    skipped = 0
    for row in rows.collect():
        event = json.loads(row.value)
        if event.get("classification_status") != "classified":
            skipped += 1
            continue
        article = canonical_article_from_event(event)
        previous_state = projection_state.get(article.article_id)
        if previous_state is not None and previous_state.matches(article):
            skipped += 1
            continue
        result = projector.update_topic_membership(
            article,
            previous_root_topic_id=previous_state.root_topic_id if previous_state is not None else None,
            previous_country_id=previous_state.country_id if previous_state is not None else None,
        )
        if result.errors:
            raise RuntimeError(f"redis topics projection failures: {result.errors}")
        projected += int(result.projected or result.updated_topic_feeds)
        if result.projected or result.updated_topic_feeds:
            projection_state.upsert(ProjectionState.from_article(article))
        else:
            skipped += 1
    print(f"imperium-redis-topics batch={batch_id} projected={projected} skipped={skipped}")


def main() -> None:
    env = os.environ
    config = Phase3RuntimeConfig.from_env()
    spark = SparkSession.builder.appName("imperium-redis-topics-driver").getOrCreate()
    projector = RedisFeedProjector(build_redis_client(config.redis.url))
    projection_state = PostgresProjectionStateRepository(
        _postgres_connection_factory(config.postgres.dsn),
        table_name=config.postgres.projection_state_table,
    )
    raw_reader = (
        spark.readStream.format("kafka")
        .option("kafka.bootstrap.servers", config.kafka.bootstrap_servers)
        .option("subscribe", config.kafka.canonical_topic)
        .option("startingOffsets", config.stream_starting_offsets(env, "redis_topics"))
    )
    max_offsets = config.stream_max_offsets_per_trigger(env, "redis_topics")
    if max_offsets:
        raw_reader = raw_reader.option("maxOffsetsPerTrigger", max_offsets)
    raw = raw_reader.load()
    stream = raw.select(col("key").cast("string").alias("key"), col("value").cast("string").alias("value"))
    writer = stream.writeStream.foreachBatch(
        lambda rows, batch_id: process_batch(rows, batch_id, projector, projection_state)
    ).option(
        "checkpointLocation",
        config.checkpoints.for_job("imperium-redis-topics-driver"),
    )
    writer = apply_trigger_processing_time(writer, config.stream_trigger_processing_time(env, "redis_topics"))
    query = writer.start()
    query.awaitTermination()


if __name__ == "__main__":
    main()
