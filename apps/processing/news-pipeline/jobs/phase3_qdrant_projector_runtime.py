from __future__ import annotations

import json
import os
from typing import Sequence

from pyspark.sql import DataFrame, SparkSession
from pyspark.sql.functions import col

from imperium_news_pipeline.phase3.canonical import canonical_article_from_event
from imperium_news_pipeline.phase3.embedding_gateway import EmbeddingRequestItem
from imperium_news_pipeline.phase3.qdrant_projection import QdrantArticleProjector
from imperium_news_pipeline.phase3.runtime_adapters import build_embedding_gateway, build_qdrant_client
from imperium_news_pipeline.phase3.runtime_config import Phase3RuntimeConfig
from imperium_news_pipeline.phase3.streaming import apply_trigger_processing_time


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
        articles.append(article)

    if not articles:
        print(f"imperium-qdrant-projector batch={batch_id} projected=0 skipped=0")
        return

    embedding_chunk_size = _embedding_chunk_size()
    projected = 0
    skipped = 0
    errors = []
    for chunk_index, chunk in enumerate(_chunks(articles, embedding_chunk_size), start=1):
        print(
            f"imperium-qdrant-projector batch={batch_id} chunk={chunk_index} "
            f"embedding={len(chunk)}",
            flush=True,
        )
        vectors = gateway.embed(
            tuple(
                EmbeddingRequestItem(article.article_id, f"{article.title}\n{article.body_text_clean}".strip())
                for article in chunk
            )
        )
        if vectors.failures:
            failure_preview = ", ".join(f"{failure.item_id}:{failure.reason}" for failure in vectors.failures[:10])
            print(
                f"imperium-qdrant-projector batch={batch_id} chunk={chunk_index} "
                f"embedding_failures={len(vectors.failures)} sample=[{failure_preview}]",
                flush=True,
            )
        projector.vectors = BatchArticleVectorGateway(vectors.embeddings)
        for article in chunk:
            if article.article_id not in vectors.embeddings:
                skipped += 1
                continue
            result = projector.project(article)
            projected += int(result.projected)
            errors.extend(result.errors)
        print(
            f"imperium-qdrant-projector batch={batch_id} chunk={chunk_index} "
            f"projected_total={projected} skipped_total={skipped}",
            flush=True,
        )
    if errors:
        raise RuntimeError(f"qdrant projection write failures: {errors}")
    print(f"imperium-qdrant-projector batch={batch_id} projected={projected} skipped={skipped}", flush=True)


def _embedding_chunk_size() -> int:
    value = int(os.getenv("PHASE3_QDRANT_EMBEDDING_CHUNK_SIZE", "128"))
    if value <= 0:
        raise ValueError("PHASE3_QDRANT_EMBEDDING_CHUNK_SIZE must be positive")
    return value


def _chunks(items: Sequence, size: int):
    for index in range(0, len(items), size):
        yield items[index : index + size]


def main() -> None:
    env = os.environ
    config = Phase3RuntimeConfig.from_env()
    spark = SparkSession.builder.appName("imperium-qdrant-driver").getOrCreate()
    qdrant = build_qdrant_client(config)
    qdrant.ensure_collection()
    gateway = build_embedding_gateway(config, config.job_nvidia_config(env, "qdrant"))
    projector = QdrantArticleProjector(qdrant=qdrant, vectors=BatchArticleVectorGateway({}))
    raw_reader = (
        spark.readStream.format("kafka")
        .option("kafka.bootstrap.servers", config.kafka.bootstrap_servers)
        .option("subscribe", config.kafka.canonical_topic)
        .option("startingOffsets", config.stream_starting_offsets(env, "qdrant"))
    )
    max_offsets = config.stream_max_offsets_per_trigger(env, "qdrant")
    if max_offsets:
        raw_reader = raw_reader.option("maxOffsetsPerTrigger", max_offsets)
    raw = raw_reader.load()
    stream = raw.select(col("key").cast("string").alias("key"), col("value").cast("string").alias("value"))
    writer = stream.writeStream.foreachBatch(
        lambda rows, batch_id: process_batch(rows, batch_id, projector, gateway)
    ).option(
        "checkpointLocation",
        config.checkpoints.for_job("imperium-qdrant-driver"),
    )
    writer = apply_trigger_processing_time(writer, config.stream_trigger_processing_time(env, "qdrant"))
    query = writer.start()
    query.awaitTermination()


if __name__ == "__main__":
    main()
