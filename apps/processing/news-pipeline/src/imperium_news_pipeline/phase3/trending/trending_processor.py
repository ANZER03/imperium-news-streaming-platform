"""Core trending batch processor.

Called from the Spark driver's ``foreachBatch``.  For each micro-batch of
classified articles, it:

  1. Filters to ``classification_status == 'classified'``
  2. Extracts candidate terms on executors
  3. Deduplicates per article
  4. Groups into time windows on executors (single groupBy pass)
  5. Fetches previous counts from Postgres (batch, single query)
  6. Joins + scores + ranks top-N on executors
  7. Collects only the final trends to driver
  8. Writes results to Redis + Postgres
"""
from __future__ import annotations

import logging
import time
from typing import Any, Mapping, Set

from pyspark.sql import DataFrame
from pyspark.sql.functions import (
    array,
    broadcast,
    coalesce,
    col,
    collect_list,
    concat_ws,
    countDistinct,
    desc,
    explode,
    greatest,
    lit,
    log1p,
    round as spark_round,
    row_number,
    slice as spark_slice,
    struct,
    udf,
    when,
    window,
)
from pyspark.sql.window import Window
from pyspark.sql.types import (
    ArrayType,
    IntegerType,
    StringType,
    StructField,
    StructType,
)

from imperium_news_pipeline.phase3.trending.term_extractor import extract_candidates
from imperium_news_pipeline.phase3.trending.redis_writer import write_trends_to_redis
from imperium_news_pipeline.phase3.trending.postgres_writer import (
    fetch_all_previous_counts,
    write_trends_to_postgres,
)

logger = logging.getLogger("TrendingProcessor")

_MAX_ARTICLE_IDS_PER_TREND = 25

_CANDIDATE_SCHEMA = ArrayType(
    StructType(
        [
            StructField("term", StringType(), nullable=False),
            StructField("term_type", StringType(), nullable=False),
        ]
    )
)

# Schema for the previous counts DataFrame created from Postgres results
_PREV_COUNTS_SCHEMA = StructType([
    StructField("window_start", StringType(), nullable=False),
    StructField("window_end", StringType(), nullable=False),
    StructField("scope_type", StringType(), nullable=False),
    StructField("scope_value", StringType(), nullable=False),
    StructField("term", StringType(), nullable=False),
    StructField("term_type", StringType(), nullable=False),
    StructField("previous_count", IntegerType(), nullable=False),
])


def _seconds_to_spark_interval(seconds: int) -> str:
    """Format seconds as a Spark SQL interval string."""
    if seconds % 3600 == 0:
        value = seconds // 3600
        unit = "hour" if value == 1 else "hours"
        return f"{value} {unit}"
    if seconds % 60 == 0:
        value = seconds // 60
        unit = "minute" if value == 1 else "minutes"
        return f"{value} {unit}"
    unit = "second" if seconds == 1 else "seconds"
    return f"{seconds} {unit}"


def _extract_candidate_rows(
    title: str | None,
    excerpt: str | None,
    body_text_clean: str | None,
    language_code: str | None,
    stopwords_map: Mapping[str, Set[str]],
    blocked_terms: Set[str],
) -> list[dict[str, str]]:
    return [
        {"term": term, "term_type": term_type}
        for term, term_type in extract_candidates(
            title=title or "",
            excerpt=excerpt or "",
            body_text_clean=body_text_clean or "",
            language_code=language_code or "unknown",
            stopwords_map=stopwords_map,
            blocked_terms=blocked_terms,
        )
    ]


def process_trending_batch(
    batch_df: DataFrame,
    batch_id: int,
    stopwords_map: Mapping[str, Set[str]],
    blocked_terms: Set[str],
    postgres_dsn: str,
    redis_client: Any,
    window_size_seconds: int = 3600,
    slide_interval_seconds: int = 300,
    global_min_count: int = 5,
    country_min_count: int = 3,
    topic_min_count: int = 3,
    country_topic_min_count: int = 3,
    global_topic_min_count: int = 3,
    top_n_global: int = 100,
    top_n_country: int = 50,
    top_n_topic: int = 50,
    top_n_country_topic: int = 50,
    top_n_global_topic: int = 50,
) -> None:
    """Process one micro-batch of classified articles for trending."""
    t0 = time.time()

    # Step 1: Filter classified articles only
    classified = batch_df.filter(
        batch_df["v.classification_status"] == "classified"
    ).select(
        col("event_time"),
        col("v.article_id").alias("article_id"),
        col("v.title").alias("title"),
        col("v.excerpt").alias("excerpt"),
        col("v.body_text_clean").alias("body_text_clean"),
        col("v.language_code").alias("language_code"),
        coalesce(col("v.country_name"), lit("unknown")).alias("country"),
        coalesce(col("v.root_topic_label"), lit("unknown")).alias("topic"),
    ).filter(
        col("event_time").isNotNull() & col("article_id").isNotNull()
    )

    extract_candidates_udf = udf(
        lambda title, excerpt, body, lang: _extract_candidate_rows(
            title,
            excerpt,
            body,
            lang,
            stopwords_map,
            blocked_terms,
        ),
        _CANDIDATE_SCHEMA,
    )

    # Step 2: Extract candidates and explode
    candidate_rows = (
        classified
        .withColumn(
            "candidate",
            explode(
                extract_candidates_udf(
                    col("title"),
                    col("excerpt"),
                    col("body_text_clean"),
                    col("language_code"),
                )
            ),
        )
        .select(
            "event_time",
            "article_id",
            "country",
            "topic",
            col("candidate.term").alias("term"),
            col("candidate.term_type").alias("term_type"),
        )
    )

    # Step 3: Expand to scoped terms (global, country, topic)
    scoped_terms = (
        candidate_rows
        .withColumn(
            "scope",
            explode(
                array(
                    struct(lit("global").alias("scope_type"), lit("global").alias("scope_value")),
                    struct(lit("country").alias("scope_type"), col("country").alias("scope_value")),
                    struct(lit("topic").alias("scope_type"), col("topic").alias("scope_value")),
                    struct(lit("country_topic").alias("scope_type"), concat_ws("|", col("country"), col("topic")).alias("scope_value")),
                    struct(lit("global_topic").alias("scope_type"), concat_ws("|", lit("global"), col("topic")).alias("scope_value")),
                )
            ),
        )
        .select(
            "event_time",
            "article_id",
            col("scope.scope_type").alias("scope_type"),
            col("scope.scope_value").alias("scope_value"),
            "term",
            "term_type",
        )
    )

    # Step 4: Window and aggregate in a SINGLE groupBy pass
    # This eliminates the duplicate scan + join from the old two-branch approach
    min_count_col = (
        when(col("scope_type") == "global", lit(global_min_count))
        .when(col("scope_type") == "country", lit(country_min_count))
        .when(col("scope_type") == "topic", lit(topic_min_count))
        .when(col("scope_type") == "country_topic", lit(country_topic_min_count))
        .otherwise(lit(global_topic_min_count))
    )

    windowed_terms = scoped_terms.withColumn(
        "event_window",
        window(
            col("event_time"),
            _seconds_to_spark_interval(window_size_seconds),
            _seconds_to_spark_interval(slide_interval_seconds),
        ),
    )
    trend_group_cols = [
        "event_window",
        "scope_type",
        "scope_value",
        "term",
        "term_type",
    ]

    # Single groupBy: countDistinct + collect article IDs in one shuffle
    counts = (
        windowed_terms
        .groupBy(*trend_group_cols)
        .agg(
            countDistinct("article_id").alias("current_count"),
            spark_slice(
                collect_list("article_id"), 1, _MAX_ARTICLE_IDS_PER_TREND
            ).alias("article_ids"),
        )
        .filter(col("current_count") >= min_count_col)
        .select(
            col("event_window.start").alias("window_start"),
            col("event_window.end").alias("window_end"),
            "scope_type",
            "scope_value",
            "term",
            "term_type",
            "current_count",
            "article_ids",
        )
    )

    # Step 5: Collect ONLY the distinct scope keys to driver (very small set)
    scope_keys = (
        counts
        .select("window_start", "window_end", "scope_type", "scope_value")
        .distinct()
        .collect()
    )

    if not scope_keys:
        logger.info(f"batch={batch_id} no trends above threshold — skipping")
        return

    logger.info(
        f"batch={batch_id} scope_keys={len(scope_keys)} "
        f"— fetching previous counts from Postgres"
    )

    # Step 6: Batch-fetch all previous counts from Postgres (single query)
    prev_counts_list = fetch_all_previous_counts(
        postgres_dsn, scope_keys, window_size_seconds,
    )

    # Step 7: Build broadcast DataFrame from previous counts and join on executors
    spark = batch_df.sparkSession

    if prev_counts_list:
        prev_df = spark.createDataFrame(prev_counts_list, _PREV_COUNTS_SCHEMA)
    else:
        prev_df = spark.createDataFrame([], _PREV_COUNTS_SCHEMA)

    # Cast window columns to match types for join
    counts_with_str_windows = counts.withColumn(
        "window_start_str",
        col("window_start").cast("string"),
    ).withColumn(
        "window_end_str",
        col("window_end").cast("string"),
    )

    join_cols = ["scope_type", "scope_value", "term", "term_type"]

    scored = (
        counts_with_str_windows
        .join(
            broadcast(prev_df),
            on=(
                (counts_with_str_windows["window_start_str"] == prev_df["window_start"])
                & (counts_with_str_windows["window_end_str"] == prev_df["window_end"])
                & (counts_with_str_windows["scope_type"] == prev_df["scope_type"])
                & (counts_with_str_windows["scope_value"] == prev_df["scope_value"])
                & (counts_with_str_windows["term"] == prev_df["term"])
                & (counts_with_str_windows["term_type"] == prev_df["term_type"])
            ),
            how="left",
        )
        .select(
            counts_with_str_windows["window_start"],
            counts_with_str_windows["window_end"],
            counts_with_str_windows["scope_type"],
            counts_with_str_windows["scope_value"],
            counts_with_str_windows["term"],
            counts_with_str_windows["term_type"],
            counts_with_str_windows["current_count"],
            counts_with_str_windows["article_ids"],
            coalesce(prev_df["previous_count"], lit(0)).alias("previous_count"),
        )
        .withColumn(
            "velocity",
            spark_round(
                col("current_count") / greatest(col("previous_count"), lit(1)),
                4,
            ),
        )
        .withColumn(
            "score",
            spark_round(log1p(col("current_count").cast("double")) * col("velocity"), 4),
        )
    )

    # Step 8: Top-N ranking ON EXECUTORS — only collect the final result
    top_n_col = (
        when(col("scope_type") == "global", lit(top_n_global))
        .when(col("scope_type") == "country", lit(top_n_country))
        .when(col("scope_type") == "topic", lit(top_n_topic))
        .when(col("scope_type") == "country_topic", lit(top_n_country_topic))
        .otherwise(lit(top_n_global_topic))
    )

    rank_window = Window.partitionBy(
        "window_start", "window_end", "scope_type", "scope_value"
    ).orderBy(desc("score"))

    final_df = (
        scored
        .withColumn("rank", row_number().over(rank_window))
        .filter(col("rank") <= top_n_col)
        .drop("rank")
    )

    # Step 9: Collect ONLY the final ranked trends to driver
    final_trends = [row.asDict(recursive=True) for row in final_df.collect()]

    if not final_trends:
        logger.info(f"batch={batch_id} no trends after ranking — skipping")
        return

    logger.info(f"batch={batch_id} final_trends={len(final_trends)}")

    # Step 10: Write to Redis
    try:
        write_trends_to_redis(
            redis_client, final_trends,
            top_n_global=top_n_global,
            top_n_country=top_n_country,
            top_n_topic=top_n_topic,
            top_n_country_topic=top_n_country_topic,
            top_n_global_topic=top_n_global_topic,
        )
    except Exception:
        logger.error(f"batch={batch_id} Redis write failed", exc_info=True)

    # Step 11: Write to Postgres
    try:
        write_trends_to_postgres(postgres_dsn, final_trends)
    except Exception:
        logger.error(f"batch={batch_id} Postgres write failed", exc_info=True)

    elapsed_ms = int((time.time() - t0) * 1000)
    logger.info(
        f"batch={batch_id} done "
        f"trends_written={len(final_trends)} elapsed_ms={elapsed_ms}"
    )
