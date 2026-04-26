from __future__ import annotations

import os

from pyspark.sql import DataFrame, SparkSession

from imperium_news_pipeline.phase3.cdc import DebeziumAvroCdcDecoder
from imperium_news_pipeline.phase3.pending_feed_runtime import PendingCanonicalFeedRuntime
from imperium_news_pipeline.phase3.runtime_adapters import build_pending_feed_runtime
from imperium_news_pipeline.phase3.runtime_config import Phase3RuntimeConfig
from imperium_news_pipeline.phase3.spark_cdc import read_debezium_avro_stream
from imperium_news_pipeline.phase3.streaming import apply_trigger_options


NEWS_TOPIC = "imperium.news.public.table_news"
NEWS_FIELDS = {
    NEWS_TOPIC: (
        "id",
        "link_id",
        "authority_id",
        "rubrique_id",
        "langue_id",
        "more_title",
        "more_url",
        "more_inner_text",
        "more_reporter",
        "more_date_text",
        "more_image_url",
        "more_video_url",
        "more_meta_keywords",
        "more_meta_description",
        "pubdate",
        "crawl_date",
        "added_in",
        "updated_in",
        "valide",
        "to_delete",
        "isvideo",
    )
}


def process_batch(rows: DataFrame, batch_id: int, runtime: PendingCanonicalFeedRuntime) -> None:
    decoder = DebeziumAvroCdcDecoder()
    decoded_changes = tuple(decoder.decode(key=_row_dict(row.key), value=_row_dict(row.value)) for row in rows.collect())
    results = runtime.apply_news_changes(decoded_changes, project_redis=False)
    emitted = sum(1 for result in results if result.emitted)
    skipped = len(results) - emitted
    print(f"phase3-canonical-pending batch={batch_id} emitted={emitted} skipped={skipped}")


def main() -> None:
    config = Phase3RuntimeConfig.from_env()
    spark = SparkSession.builder.appName("phase3-canonical-article-processor").getOrCreate()
    runtime = build_pending_feed_runtime(config)
    stream = read_debezium_avro_stream(
        spark,
        bootstrap_servers=config.kafka.bootstrap_servers,
        schema_registry_url=config.kafka.schema_registry_url,
        topics=(NEWS_TOPIC,),
        starting_offsets=os.getenv("PHASE3_STARTING_OFFSETS", "earliest"),
        max_offsets_per_trigger=os.getenv("PHASE3_MAX_OFFSETS_PER_TRIGGER"),
        payload_fields_by_topic=NEWS_FIELDS,
    )
    writer = stream.writeStream.foreachBatch(lambda rows, batch_id: process_batch(rows, batch_id, runtime)).option(
        "checkpointLocation",
        config.checkpoints.for_job("phase3-canonical-article-processor"),
    )
    writer = apply_trigger_options(writer)
    query = writer.start()
    query.awaitTermination()


def _row_dict(value):
    return value.asDict(recursive=True) if value is not None else None


if __name__ == "__main__":
    main()
