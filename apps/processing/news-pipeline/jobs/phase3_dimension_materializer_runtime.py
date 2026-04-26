from __future__ import annotations

import os
from collections import defaultdict

from pyspark.sql import DataFrame, SparkSession

from imperium_news_pipeline.phase3.cdc import DebeziumAvroCdcDecoder
from imperium_news_pipeline.phase3.dimensions import DimensionMaterializer, DimensionRecord
from imperium_news_pipeline.phase3.pending_feed_runtime import dimension_record_from_change
from imperium_news_pipeline.phase3.runtime_adapters import build_pending_feed_runtime
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


def process_batch(rows: DataFrame, batch_id: int, materializer: DimensionMaterializer) -> None:
    decoder = DebeziumAvroCdcDecoder()
    grouped: dict[str, list[DimensionRecord]] = defaultdict(list)
    for row in rows.collect():
        change = decoder.decode(key=_row_dict(row.key), value=_row_dict(row.value))
        record = dimension_record_from_change(change)
        grouped[record.dimension_type].append(record)

    materialized = 0
    for records in grouped.values():
        materialized += materializer.materialize_many(tuple(records))
    print(f"phase3-dimension-materializer batch={batch_id} materialized={materialized}")


def main() -> None:
    config = Phase3RuntimeConfig.from_env()
    spark = SparkSession.builder.appName("phase3-dimension-materializer").getOrCreate()
    runtime = build_pending_feed_runtime(config)
    materializer = runtime.dimensions
    topics = selected_dimension_topics()
    stream = read_debezium_avro_stream(
        spark,
        bootstrap_servers=config.kafka.bootstrap_servers,
        schema_registry_url=config.kafka.schema_registry_url,
        topics=topics,
        starting_offsets=os.getenv("PHASE3_STARTING_OFFSETS", "earliest"),
        max_offsets_per_trigger=os.getenv("PHASE3_MAX_OFFSETS_PER_TRIGGER"),
        payload_fields_by_topic={topic: DIMENSION_FIELDS[topic] for topic in topics},
    )
    writer = stream.writeStream.foreachBatch(lambda rows, batch_id: process_batch(rows, batch_id, materializer)).option(
        "checkpointLocation",
        config.checkpoints.for_job("phase3-dimension-materializer"),
    )
    writer = apply_trigger_options(writer)
    query = writer.start()
    query.awaitTermination()


def _row_dict(value):
    return value.asDict(recursive=True) if value is not None else None


if __name__ == "__main__":
    main()
