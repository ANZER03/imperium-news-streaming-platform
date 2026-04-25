from __future__ import annotations

import json
import os
from typing import Any

from pyspark.sql import DataFrame, SparkSession
from pyspark.sql.functions import col, from_json
from pyspark.sql.types import BooleanType, IntegerType, StringType, StructField, StructType, TimestampType

from imperium_news_pipeline.phase3.canonical import (
    CanonicalArticleBuilder,
    CanonicalArticleFirstEmitProcessor,
    NewsArticleIdProvider,
    RawNewsRecord,
    SystemClock,
)


NEWS_VALUE_SCHEMA = StructType(
    [
        StructField("id", IntegerType(), False),
        StructField("link_id", IntegerType(), True),
        StructField("authority_id", IntegerType(), True),
        StructField("rubrique_id", IntegerType(), True),
        StructField("langue_id", IntegerType(), True),
        StructField("more_title", StringType(), True),
        StructField("more_url", StringType(), True),
        StructField("more_inner_text", StringType(), True),
        StructField("more_reporter", StringType(), True),
        StructField("more_date_text", StringType(), True),
        StructField("more_image_url", StringType(), True),
        StructField("more_video_url", StringType(), True),
        StructField("more_meta_keywords", StringType(), True),
        StructField("more_meta_description", StringType(), True),
        StructField("pubdate", TimestampType(), True),
        StructField("crawl_date", TimestampType(), True),
        StructField("added_in", TimestampType(), True),
        StructField("updated_in", TimestampType(), True),
        StructField("valide", BooleanType(), True),
        StructField("to_delete", BooleanType(), True),
        StructField("isvideo", BooleanType(), True),
    ]
)


def build_news_stream(spark: SparkSession, bootstrap_servers: str, topic: str) -> DataFrame:
    raw = (
        spark.readStream.format("kafka")
        .option("kafka.bootstrap.servers", bootstrap_servers)
        .option("subscribe", topic)
        .option("startingOffsets", os.getenv("PHASE3_STARTING_OFFSETS", "latest"))
        .load()
    )
    return raw.select(from_json(col("value").cast("string"), NEWS_VALUE_SCHEMA).alias("value")).select("value.*")


def process_micro_batch(rows: DataFrame, batch_id: int, repository: Any, producer: Any) -> None:
    processor = CanonicalArticleFirstEmitProcessor(
        builder=CanonicalArticleBuilder(id_provider=NewsArticleIdProvider(), clock=SystemClock()),
        repository=repository,
        producer=producer,
    )
    for row in rows.toLocalIterator():
        processor.process(RawNewsRecord.from_mapping(row.asDict(recursive=True)))


def main() -> None:
    spark = SparkSession.builder.appName("phase3-canonical-article-first-emit").getOrCreate()
    bootstrap_servers = os.environ["PHASE3_KAFKA_BOOTSTRAP_SERVERS"]
    source_topic = os.environ["PHASE3_NEWS_SOURCE_TOPIC"]

    # Runtime adapters are injected at the Spark job boundary. The concrete
    # PostgreSQL repository and Kafka producer are implemented in the deployment
    # slice that wires credentials and cluster destinations.
    repository = _missing_runtime_adapter("PHASE3_CLEANED_ARTICLE_REPOSITORY")
    producer = _missing_runtime_adapter("PHASE3_CANONICAL_ARTICLE_PRODUCER")

    query = (
        build_news_stream(spark, bootstrap_servers, source_topic)
        .writeStream.foreachBatch(lambda rows, batch_id: process_micro_batch(rows, batch_id, repository, producer))
        .option("checkpointLocation", os.environ["PHASE3_CANONICAL_CHECKPOINT_LOCATION"])
        .start()
    )
    query.awaitTermination()


def _missing_runtime_adapter(name: str) -> Any:
    raise RuntimeError(
        f"{name} is not wired. Implement the concrete adapter in the deployment boundary; "
        "core processing already depends on repository and producer abstractions."
    )


if __name__ == "__main__":
    main()
