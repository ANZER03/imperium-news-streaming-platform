from __future__ import annotations

import json
import os

from pyspark.sql import DataFrame, SparkSession
from pyspark.sql.functions import col

from imperium_news_pipeline.phase3.canonical import canonical_article_from_event
from imperium_news_pipeline.phase3.embedding_gateway import EmbeddingRequestItem
from imperium_news_pipeline.phase3.qdrant_projection import QdrantArticleProjector
from imperium_news_pipeline.phase3.runtime_adapters import build_embedding_gateway, build_qdrant_client
from imperium_news_pipeline.phase3.runtime_config import Phase3RuntimeConfig
from imperium_news_pipeline.phase3.streaming import apply_trigger_options


class BatchArticleVectorGateway:
    def __init__(self, vectors):
        self._vectors = vectors

    def vector_for(self, article):
        return self._vectors[article.article_id]


def process_batch(rows: DataFrame, batch_id: int, projector: QdrantArticleProjector, gateway) -> None:
    articles = []
    for row in rows.collect():
        event = json.loads(row.value)
        if event.get("classification_status") != "classified":
            continue
        article = canonical_article_from_event(event)
        if not article.is_visible:
            continue
        articles.append(article)

    if not articles:
        print(f"phase3-qdrant-projector batch={batch_id} projected=0 skipped=0")
        return

    vectors = gateway.embed(
        tuple(EmbeddingRequestItem(article.article_id, f"{article.title}\n{article.body_text_clean}".strip()) for article in articles)
    )
    if vectors.failures:
        raise RuntimeError(f"qdrant projection embedding failures: {vectors.failures}")
    projector.vectors = BatchArticleVectorGateway(vectors.embeddings)

    projected = 0
    errors = []
    for article in articles:
        result = projector.project(article)
        projected += int(result.projected)
        errors.extend(result.errors)
    if errors:
        raise RuntimeError(f"qdrant projection write failures: {errors}")
    skipped = len(articles) - projected
    print(f"phase3-qdrant-projector batch={batch_id} projected={projected} skipped={skipped}")


def main() -> None:
    config = Phase3RuntimeConfig.from_env()
    spark = SparkSession.builder.appName("phase3-qdrant-projector-runtime").getOrCreate()
    qdrant = build_qdrant_client(config)
    qdrant.ensure_collection()
    gateway = build_embedding_gateway(config)
    projector = QdrantArticleProjector(qdrant=qdrant, vectors=BatchArticleVectorGateway({}))
    raw_reader = (
        spark.readStream.format("kafka")
        .option("kafka.bootstrap.servers", config.kafka.bootstrap_servers)
        .option("subscribe", config.kafka.canonical_topic)
        .option("startingOffsets", os.getenv("PHASE3_STARTING_OFFSETS", "latest"))
    )
    max_offsets = os.getenv("PHASE3_MAX_OFFSETS_PER_TRIGGER")
    if max_offsets:
        raw_reader = raw_reader.option("maxOffsetsPerTrigger", max_offsets)
    raw = raw_reader.load()
    stream = raw.select(col("key").cast("string").alias("key"), col("value").cast("string").alias("value"))
    writer = stream.writeStream.foreachBatch(
        lambda rows, batch_id: process_batch(rows, batch_id, projector, gateway)
    ).option(
        "checkpointLocation",
        config.checkpoints.for_job("phase3-qdrant-projector-runtime"),
    )
    writer = apply_trigger_options(writer)
    query = writer.start()
    query.awaitTermination()


if __name__ == "__main__":
    main()
