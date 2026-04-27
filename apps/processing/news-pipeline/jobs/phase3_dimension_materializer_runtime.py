from __future__ import annotations

import os
from collections import defaultdict
from typing import Iterable

from pyspark.sql import DataFrame, SparkSession

from imperium_news_pipeline.phase3.cdc import DebeziumAvroCdcDecoder
from imperium_news_pipeline.phase3.dimensions import DimensionMaterializer, DimensionRecord
from imperium_news_pipeline.phase3.pending_feed_runtime import dimension_record_from_change
from imperium_news_pipeline.phase3.runtime_adapters import PostgresDimensionRepository, _postgres_connection_factory
from imperium_news_pipeline.phase3.runtime_config import Phase3RuntimeConfig
from imperium_news_pipeline.phase3.spark_cdc import read_debezium_avro_stream
from imperium_news_pipeline.phase3.streaming import apply_trigger_options


DIMENSION_TOPICS = (
    "imperium.reference.public.table_pays",
    "imperium.reference.public.table_langue",
    "imperium.reference.public.table_rubrique",
    "imperium.reference.public.table_sedition",
    "imperium.metadata.public.table_authority",
    "imperium.metadata.public.table_links",
)

DIMENSION_TOPIC_GROUPS = {
    "reference": (
        "imperium.reference.public.table_pays",
        "imperium.reference.public.table_langue",
        "imperium.reference.public.table_rubrique",
        "imperium.reference.public.table_sedition",
    ),
    "authority": ("imperium.metadata.public.table_authority",),
    "links": ("imperium.metadata.public.table_links",),
}

DIMENSION_FIELDS = {
    "imperium.reference.public.table_pays": ("id", "name", "pays"),
    "imperium.reference.public.table_langue": ("id", "code", "abr"),
    "imperium.reference.public.table_rubrique": ("id", "title", "rubrique"),
    "imperium.reference.public.table_sedition": ("id", "pays_id"),
    "imperium.metadata.public.table_authority": ("id", "name", "authority", "title", "domain", "sedition_id"),
    "imperium.metadata.public.table_links": ("id", "url", "link", "domain", "source_name", "title", "pays_id"),
}


def selected_dimension_topics() -> tuple[str, ...]:
    configured = os.getenv("PHASE3_DIMENSION_TOPICS", "").strip()
    if not configured:
        return DIMENSION_TOPICS
    topics = tuple(topic.strip() for topic in configured.split(",") if topic.strip())
    unknown = tuple(topic for topic in topics if topic not in DIMENSION_FIELDS)
    if unknown:
        raise ValueError(f"unsupported PHASE3_DIMENSION_TOPICS entries: {', '.join(unknown)}")
    return topics


def selected_dimension_topic_groups() -> dict[str, tuple[str, ...]]:
    configured = os.getenv("PHASE3_DIMENSION_TOPICS", "").strip()
    if configured:
        return {"custom": selected_dimension_topics()}
    return DIMENSION_TOPIC_GROUPS


def process_batch(rows: DataFrame, batch_id: int, postgres_dsn: str, batch_size: int, job_name: str) -> None:
    accumulator = rows.sparkSession.sparkContext.accumulator(0)
    rows.foreachPartition(
        lambda partition: _materialize_partition(partition, postgres_dsn, batch_size, accumulator)
    )
    print(f"{job_name} batch={batch_id} materialized={int(accumulator.value)}")


def _materialize_partition(rows: Iterable, postgres_dsn: str, batch_size: int, accumulator) -> None:
    decoder = DebeziumAvroCdcDecoder()
    materializer = DimensionMaterializer(
        repository=PostgresDimensionRepository(_postgres_connection_factory(postgres_dsn))
    )
    grouped: dict[str, list[DimensionRecord]] = defaultdict(list)
    buffered = 0
    materialized = 0
    for row in rows:
        change = decoder.decode(key=_row_dict(row.key), value=_row_dict(row.value))
        record = dimension_record_from_change(change)
        grouped[record.dimension_type].append(record)
        buffered += 1
        if buffered >= batch_size:
            flushed = _flush_grouped_records(materializer, grouped)
            materialized += flushed
            accumulator += flushed
            grouped.clear()
            buffered = 0

    flushed = _flush_grouped_records(materializer, grouped)
    materialized += flushed
    accumulator += flushed


def _flush_grouped_records(materializer: DimensionMaterializer, grouped: dict[str, list[DimensionRecord]]) -> int:
    materialized = 0
    for records in grouped.values():
        materialized += materializer.materialize_many(tuple(records))
    return materialized


def main() -> None:
    config = Phase3RuntimeConfig.from_env()
    job_name = os.getenv("PHASE3_DIMENSION_JOB_NAME", "imperium-dimension-driver")
    batch_size = int(os.getenv("PHASE3_DIMENSION_DB_BATCH_SIZE", "1000"))
    if batch_size <= 0:
        raise ValueError("PHASE3_DIMENSION_DB_BATCH_SIZE must be positive")
    spark = SparkSession.builder.appName(job_name).getOrCreate()
    for group_name, topics in selected_dimension_topic_groups().items():
        stream = read_debezium_avro_stream(
            spark,
            bootstrap_servers=config.kafka.bootstrap_servers,
            schema_registry_url=config.kafka.schema_registry_url,
            topics=topics,
            starting_offsets=os.getenv("PHASE3_STARTING_OFFSETS", "earliest"),
            max_offsets_per_trigger=_max_offsets_per_trigger(group_name),
            payload_fields_by_topic={topic: DIMENSION_FIELDS[topic] for topic in topics},
        )
        query_name = f"{job_name}-{group_name}"
        writer = stream.writeStream.foreachBatch(
            lambda rows, batch_id, query_name=query_name: process_batch(
                rows,
                batch_id,
                config.postgres.dsn,
                batch_size,
                query_name,
            )
        ).option(
            "checkpointLocation",
            config.checkpoints.for_job(query_name),
        )
        writer = apply_trigger_options(writer)
        writer.start(queryName=query_name)
    spark.streams.awaitAnyTermination()


def _max_offsets_per_trigger(group_name: str) -> str | None:
    env_name = f"PHASE3_{group_name.upper().replace('-', '_')}_MAX_OFFSETS_PER_TRIGGER"
    return os.getenv(env_name) or os.getenv("PHASE3_MAX_OFFSETS_PER_TRIGGER")


def _row_dict(value):
    return value.asDict(recursive=True) if value is not None else None


if __name__ == "__main__":
    main()
