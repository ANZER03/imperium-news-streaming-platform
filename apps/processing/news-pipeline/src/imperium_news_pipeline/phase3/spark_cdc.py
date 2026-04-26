from __future__ import annotations

import json
from typing import Mapping, Sequence
from urllib.request import urlopen

from pyspark.sql import DataFrame, SparkSession
from pyspark.sql.avro.functions import from_avro
from pyspark.sql.functions import col, expr, lit, struct


def read_debezium_avro_stream(
    spark: SparkSession,
    *,
    bootstrap_servers: str,
    schema_registry_url: str,
    topics: Sequence[str],
    starting_offsets: str,
    max_offsets_per_trigger: str | None = None,
    payload_fields_by_topic: Mapping[str, Sequence[str]] | None = None,
) -> DataFrame:
    """Read Confluent wire-format Debezium Avro records from Kafka."""

    reader = (
        spark.readStream.format("kafka")
        .option("kafka.bootstrap.servers", bootstrap_servers)
        .option("subscribe", ",".join(topics))
        .option("startingOffsets", starting_offsets)
    )
    if max_offsets_per_trigger:
        reader = reader.option("maxOffsetsPerTrigger", max_offsets_per_trigger)
    raw = reader.load()
    decoded = raw
    for topic in topics:
        value_schema = latest_schema(schema_registry_url, f"{topic}-value")
        key_schema = latest_schema(schema_registry_url, f"{topic}-key", required=False)
        topic_rows = raw.where(col("topic") == topic).select(
            col("topic"),
            col("partition"),
            col("offset"),
            from_avro(_confluent_payload("value"), value_schema).alias("value"),
            (
                from_avro(_confluent_payload("key"), key_schema).alias("key")
                if key_schema is not None
                else expr("CAST(NULL AS STRUCT<id:INT>)").alias("key")
            ),
        )
        fields = tuple((payload_fields_by_topic or {}).get(topic, ()))
        if fields:
            value_type = topic_rows.schema["value"].dataType
            after_type = value_type["after"].dataType
            available_fields = set(after_type.names)
            topic_rows = topic_rows.select(
                col("topic"),
                col("partition"),
                col("offset"),
                col("key"),
                _slim_value(fields, available_fields).alias("value"),
            )
        decoded = topic_rows if decoded is raw else decoded.unionByName(topic_rows, allowMissingColumns=True)
    return decoded


def latest_schema(schema_registry_url: str, subject: str, *, required: bool = True) -> str | None:
    url = f"{schema_registry_url.rstrip('/')}/subjects/{subject}/versions/latest"
    try:
        with urlopen(url, timeout=10) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except Exception:
        if required:
            raise
        return None
    return payload["schema"]


def _confluent_payload(column_name: str):
    # Confluent Avro wire format is: magic byte + 4-byte schema id + Avro payload.
    return expr(f"substring({column_name}, 6, length({column_name}) - 5)")


def _slim_value(fields: Sequence[str], available_fields: set[str]):
    before = struct(*[_payload_field("before", field, available_fields) for field in fields])
    after = struct(*[_payload_field("after", field, available_fields) for field in fields])
    return struct(
        col("value.op").alias("op"),
        struct(col("value.source.schema").alias("schema"), col("value.source.table").alias("table")).alias("source"),
        before.alias("before"),
        after.alias("after"),
        col("value.ts_ms").alias("ts_ms"),
        lit(None).cast("long").alias("ts_us"),
        lit(None).cast("long").alias("ts_ns"),
    )


def _payload_field(payload_name: str, field: str, available_fields: set[str]):
    if field in available_fields:
        return col(f"value.{payload_name}.{field}").alias(field)
    return lit(None).alias(field)
