from __future__ import annotations

import os
from typing import Any, Callable

from pyspark.sql import DataFrame, SparkSession
from pyspark.sql.functions import col, from_json
from pyspark.sql.types import BooleanType, IntegerType, StringType, StructField, StructType

from imperium_news_pipeline.phase3.dimensions import (
    DimensionMaterializer,
    authority_dimension,
    country_dimension,
    language_dimension,
    link_dimension,
    rubric_dimension,
    sedition_dimension,
)


CDC_ENVELOPE_SCHEMA = StructType(
    [
        StructField("id", IntegerType(), False),
        StructField("url", StringType(), True),
        StructField("domain", StringType(), True),
        StructField("source_name", StringType(), True),
        StructField("name", StringType(), True),
        StructField("title", StringType(), True),
        StructField("code", StringType(), True),
        StructField("pays_id", IntegerType(), True),
        StructField("sedition_id", IntegerType(), True),
        StructField("__deleted", BooleanType(), True),
    ]
)


DIMENSION_BUILDERS: dict[str, Callable[[dict[str, Any]], Any]] = {
    "links": link_dimension,
    "authorities": authority_dimension,
    "seditions": sedition_dimension,
    "countries": country_dimension,
    "rubrics": rubric_dimension,
    "languages": language_dimension,
}


def build_dimension_stream(spark: SparkSession, bootstrap_servers: str, topic: str) -> DataFrame:
    raw = (
        spark.readStream.format("kafka")
        .option("kafka.bootstrap.servers", bootstrap_servers)
        .option("subscribe", topic)
        .option("startingOffsets", os.getenv("PHASE3_STARTING_OFFSETS", "latest"))
        .load()
    )
    return raw.select(from_json(col("value").cast("string"), CDC_ENVELOPE_SCHEMA).alias("value")).select("value.*")


def process_dimension_micro_batch(rows: DataFrame, batch_id: int, dimension_type: str, materializer: DimensionMaterializer) -> None:
    builder = DIMENSION_BUILDERS[dimension_type]
    for row in rows.toLocalIterator():
        materializer.materialize(builder(row.asDict(recursive=True)))


def main() -> None:
    spark = SparkSession.builder.appName("phase3-dimension-materializer").getOrCreate()
    bootstrap_servers = os.environ["PHASE3_KAFKA_BOOTSTRAP_SERVERS"]
    materializer = _missing_runtime_adapter("PHASE3_DIMENSION_MATERIALIZER")

    queries = []
    for dimension_type, topic in _dimension_topics_from_env().items():
        query = (
            build_dimension_stream(spark, bootstrap_servers, topic)
            .writeStream.foreachBatch(
                lambda rows, batch_id, dimension_type=dimension_type: process_dimension_micro_batch(
                    rows,
                    batch_id,
                    dimension_type,
                    materializer,
                )
            )
            .option("checkpointLocation", f"{os.environ['PHASE3_DIMENSION_CHECKPOINT_ROOT']}/{dimension_type}")
            .start()
        )
        queries.append(query)

    for query in queries:
        query.awaitTermination()


def _dimension_topics_from_env() -> dict[str, str]:
    return {
        "links": os.environ["PHASE3_LINKS_SOURCE_TOPIC"],
        "authorities": os.environ["PHASE3_AUTHORITIES_SOURCE_TOPIC"],
        "seditions": os.environ["PHASE3_SEDITIONS_SOURCE_TOPIC"],
        "countries": os.environ["PHASE3_COUNTRIES_SOURCE_TOPIC"],
        "rubrics": os.environ["PHASE3_RUBRICS_SOURCE_TOPIC"],
        "languages": os.environ["PHASE3_LANGUAGES_SOURCE_TOPIC"],
    }


def _missing_runtime_adapter(name: str) -> Any:
    raise RuntimeError(
        f"{name} is not wired. Implement the concrete adapter in the deployment boundary; "
        "dimension projection core already depends on repository and producer abstractions."
    )


if __name__ == "__main__":
    main()
