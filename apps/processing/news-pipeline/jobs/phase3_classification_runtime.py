from __future__ import annotations

import json
import os

from pyspark.sql import DataFrame, SparkSession
from pyspark.sql.functions import col

from imperium_news_pipeline.phase3.canonical import canonical_article_from_event
from imperium_news_pipeline.phase3.classification import ArticleClassificationProcessor, EmbeddingSimilarityClassifier
from imperium_news_pipeline.phase3.runtime_adapters import (
    KafkaCanonicalArticleProducer,
    PostgresTopicEmbeddingRepository,
    PostgresTopicTaxonomyRepository,
    build_embedding_gateway,
    _kafka_producer,
    _postgres_connection_factory,
)
from imperium_news_pipeline.phase3.postgres import PostgresCleanedArticleRepository
from imperium_news_pipeline.phase3.runtime_config import Phase3RuntimeConfig
from imperium_news_pipeline.phase3.canonical import SystemClock
from imperium_news_pipeline.phase3.streaming import apply_trigger_processing_time
from imperium_news_pipeline.phase3.topics import TopicTaxonomyService


def process_batch(rows: DataFrame, batch_id: int, processor: ArticleClassificationProcessor) -> None:
    enriched_articles = []
    for row in rows.collect():
        event = json.loads(row.value)
        if event.get("classification_status") != "enriched":
            continue
        enriched_articles.append(canonical_article_from_event(event))

    decisions = processor.process_many(tuple(enriched_articles))
    emitted = sum(1 for decision in decisions if decision)
    skipped = len(enriched_articles) - emitted
    print(f"imperium-classification-runtime batch={batch_id} classified={emitted} skipped={skipped}")


def main() -> None:
    env = os.environ
    config = Phase3RuntimeConfig.from_env()
    spark = SparkSession.builder.appName("imperium-classification-driver").getOrCreate()
    nvidia_config = config.job_nvidia_config(env, "classification")
    connection_factory = _postgres_connection_factory(config.postgres.dsn)
    processor = ArticleClassificationProcessor(
        classifier=EmbeddingSimilarityClassifier(
            gateway=build_embedding_gateway(config, nvidia_config),
            taxonomy_service=TopicTaxonomyService(
                PostgresTopicTaxonomyRepository(connection_factory, table_name=config.postgres.topic_taxonomy_table)
            ),
            topic_embedding_repository=PostgresTopicEmbeddingRepository(
                connection_factory,
                table_name=config.postgres.topic_embeddings_table,
            ),
            embedding_model=nvidia_config.embedding_model,
        ),
        repository=PostgresCleanedArticleRepository(connection_factory, article_table=config.postgres.article_table),
        producer=KafkaCanonicalArticleProducer(
            producer=_kafka_producer(config.kafka.bootstrap_servers),
            topic=config.kafka.canonical_topic,
        ),
        clock=SystemClock(),
    )

    raw_reader = (
        spark.readStream.format("kafka")
        .option("kafka.bootstrap.servers", config.kafka.bootstrap_servers)
        .option("subscribe", config.kafka.canonical_topic)
        .option("startingOffsets", config.stream_starting_offsets(env, "classification"))
    )
    max_offsets = config.stream_max_offsets_per_trigger(env, "classification")
    if max_offsets:
        raw_reader = raw_reader.option("maxOffsetsPerTrigger", max_offsets)
    raw = raw_reader.load()
    stream = raw.select(col("key").cast("string").alias("key"), col("value").cast("string").alias("value"))
    writer = stream.writeStream.foreachBatch(lambda rows, batch_id: process_batch(rows, batch_id, processor)).option(
        "checkpointLocation",
        config.checkpoints.for_job("imperium-classification-driver"),
    )
    writer = apply_trigger_processing_time(writer, config.stream_trigger_processing_time(env, "classification"))
    query = writer.start()
    query.awaitTermination()


if __name__ == "__main__":
    main()
