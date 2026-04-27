from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
import os
from typing import TYPE_CHECKING, Any, Iterable, Mapping

from imperium_news_pipeline.phase3.cdc import DebeziumAvroCdcDecoder
from imperium_news_pipeline.phase3.dimensions import DimensionMaterializer, DimensionRecord
from imperium_news_pipeline.phase3.pending_feed_runtime import dimension_record_from_change
from imperium_news_pipeline.phase3.runtime_adapters import PostgresDimensionRepository, _postgres_connection_factory
from imperium_news_pipeline.phase3.runtime_config import Phase3RuntimeConfig
from imperium_news_pipeline.phase3.streaming import apply_trigger_processing_time

if TYPE_CHECKING:
    from pyspark.sql import DataFrame


REFERENCE_TOPICS = (
    "imperium.reference.public.table_pays",
    "imperium.reference.public.table_langue",
    "imperium.reference.public.table_rubrique",
    "imperium.reference.public.table_sedition",
)
AUTHORITY_TOPICS = ("imperium.metadata.public.table_authority",)
LINKS_TOPICS = ("imperium.metadata.public.table_links",)

DIMENSION_JOB_TOPICS = {
    "reference": REFERENCE_TOPICS,
    "authority": AUTHORITY_TOPICS,
    "links": LINKS_TOPICS,
}

DIMENSION_FIELDS = {
    "imperium.reference.public.table_pays": ("id", "name", "pays"),
    "imperium.reference.public.table_langue": ("id", "code", "abr"),
    "imperium.reference.public.table_rubrique": ("id", "title", "rubrique"),
    "imperium.reference.public.table_sedition": ("id", "pays_id"),
    "imperium.metadata.public.table_authority": ("id", "name", "authority", "title", "domain", "sedition_id"),
    "imperium.metadata.public.table_links": ("id", "url", "link", "domain", "source_name", "title", "pays_id"),
}


@dataclass(frozen=True)
class DimensionJobDefinition:
    key: str
    app_name: str
    checkpoint_job_name: str
    topics: tuple[str, ...]


def build_dimension_job(job_key: str) -> DimensionJobDefinition:
    normalized = job_key.strip().lower()
    if normalized not in DIMENSION_JOB_TOPICS:
        raise ValueError(f"unsupported dimension job: {job_key}")
    return DimensionJobDefinition(
        key=normalized,
        app_name=f"imperium-dimension-{normalized}-driver",
        checkpoint_job_name=f"imperium-dimension-{normalized}-driver",
        topics=DIMENSION_JOB_TOPICS[normalized],
    )


def selected_dimension_topics(job_key: str, env: Mapping[str, str] | None = None) -> tuple[str, ...]:
    job = build_dimension_job(job_key)
    configured = tuple(_configured_topics(job.key, env))
    if not configured:
        return job.topics
    unknown = tuple(topic for topic in configured if topic not in DIMENSION_FIELDS)
    if unknown:
        raise ValueError(f"unsupported {job_env_prefix(job.key)}_TOPICS entries: {', '.join(unknown)}")
    invalid = tuple(topic for topic in configured if topic not in job.topics)
    if invalid:
        raise ValueError(
            f"unsupported {job_env_prefix(job.key)}_TOPICS entries for {job.key}: {', '.join(invalid)}"
        )
    return configured


def job_env_prefix(job_key: str) -> str:
    return f"PHASE3_{build_dimension_job(job_key).key.upper()}"


def dimension_db_batch_size(env: Mapping[str, str], job_key: str) -> int:
    job_value = env.get(f"{job_env_prefix(job_key)}_DB_BATCH_SIZE", "").strip()
    value = int(job_value or env.get("PHASE3_DIMENSION_DB_BATCH_SIZE", "1000"))
    if value <= 0:
        raise ValueError("dimension DB batch size must be positive")
    return value


def run_dimension_job(job_key: str, env: Mapping[str, str] | None = None) -> None:
    from pyspark.sql import SparkSession
    from imperium_news_pipeline.phase3.spark_cdc import read_debezium_avro_stream

    values = os.environ if env is None else env
    job = build_dimension_job(job_key)
    config = Phase3RuntimeConfig.from_env(values)
    topics = selected_dimension_topics(job.key, values)
    batch_size = dimension_db_batch_size(values, job.key)
    spark = SparkSession.builder.appName(job.app_name).getOrCreate()
    stream = read_debezium_avro_stream(
        spark,
        bootstrap_servers=config.kafka.bootstrap_servers,
        schema_registry_url=config.kafka.schema_registry_url,
        topics=topics,
        starting_offsets=config.stream_starting_offsets(values, job.key),
        max_offsets_per_trigger=config.stream_max_offsets_per_trigger(values, job.key),
        payload_fields_by_topic={topic: DIMENSION_FIELDS[topic] for topic in topics},
    )
    writer = stream.writeStream.foreachBatch(
        lambda rows, batch_id: process_batch(rows, batch_id, config.postgres.dsn, batch_size, job.app_name)
    ).option(
        "checkpointLocation",
        config.checkpoints.for_job(job.checkpoint_job_name),
    )
    writer = apply_trigger_processing_time(writer, config.stream_trigger_processing_time(values, job.key))
    query = writer.start(queryName=job.app_name)
    query.awaitTermination()


def process_batch(rows: "DataFrame", batch_id: int, postgres_dsn: str, batch_size: int, job_name: str) -> None:
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
    for row in rows:
        change = decoder.decode(key=_row_dict(row.key), value=_row_dict(row.value))
        record = dimension_record_from_change(change)
        grouped[record.dimension_type].append(record)
        buffered += 1
        if buffered >= batch_size:
            flushed = _flush_grouped_records(materializer, grouped)
            accumulator += flushed
            grouped.clear()
            buffered = 0

    accumulator += _flush_grouped_records(materializer, grouped)


def _flush_grouped_records(materializer: DimensionMaterializer, grouped: Mapping[str, list[DimensionRecord]]) -> int:
    materialized = 0
    for records in grouped.values():
        materialized += materializer.materialize_many(tuple(records))
    return materialized


def _configured_topics(job_key: str, env: Mapping[str, str] | None = None) -> tuple[str, ...]:
    values = os.environ if env is None else env
    configured = values.get(f"{job_env_prefix(job_key)}_TOPICS", "").strip()
    if configured:
        return tuple(topic.strip() for topic in configured.split(",") if topic.strip())
    return ()


def _row_dict(value: Any):
    if value is None:
        return None
    if isinstance(value, dict):
        return value
    return value.asDict(recursive=True)
