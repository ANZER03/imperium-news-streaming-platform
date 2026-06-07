"""Core trending batch processor.

Called from the Spark driver's ``foreachBatch``.  For each micro-batch of
classified articles, it:

  1. Filters to ``classification_status == 'classified'``
  2. Extracts candidate terms on executors
  3. Deduplicates per article
  4. Groups into time windows on executors
  5. Aggregates counts per scope (global, country, topic) on executors
  6. Calculates trending score using velocity from Postgres
  7. Applies minimum thresholds and top-N ranking
  8. Writes results to Redis + Postgres
"""
from __future__ import annotations

import logging
import math
import time
from datetime import datetime, timedelta
from typing import Any, Dict, List, Mapping, Set

from pyspark.sql import DataFrame
from pyspark.sql.functions import (
    array,
    coalesce,
    collect_list,
    col,
    countDistinct,
    explode,
    lit,
    row_number,
    struct,
    udf,
    when,
    window,
)
from pyspark.sql.window import Window
from pyspark.sql.types import ArrayType, StringType, StructField, StructType

from imperium_news_pipeline.phase3.trending.term_extractor import extract_candidates
from imperium_news_pipeline.phase3.trending.redis_writer import write_trends_to_redis
from imperium_news_pipeline.phase3.trending.postgres_writer import (
    fetch_previous_counts,
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


def _compute_score(current: int, previous: int) -> tuple[float, float]:
    """Return (velocity, score) per PRD §14."""
    velocity = current / max(previous, 1)
    score = math.log(1 + current) * velocity
    return round(velocity, 4), round(score, 4)


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


def _iso_timestamp(value: Any) -> str:
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


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
    top_n_global: int = 100,
    top_n_country: int = 50,
    top_n_topic: int = 50,
) -> None:
    """Process one micro-batch of classified articles for trending."""
    t0 = time.time()

    # Step 1: Filter classified articles only. Everything through aggregation
    # remains in Spark so CPU-heavy work is scheduled across executors.
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

    scoped_terms = (
        candidate_rows
        .withColumn(
            "scope",
            explode(
                array(
                    struct(lit("global").alias("scope_type"), lit("global").alias("scope_value")),
                    struct(lit("country").alias("scope_type"), col("country").alias("scope_value")),
                    struct(lit("topic").alias("scope_type"), col("topic").alias("scope_value")),
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

    min_count_col = (
        when(col("scope_type") == "global", lit(global_min_count))
        .when(col("scope_type") == "country", lit(country_min_count))
        .otherwise(lit(topic_min_count))
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

    counts = (
        windowed_terms
        .groupBy(*trend_group_cols)
        .agg(countDistinct("article_id").alias("current_count"))
        .filter(col("current_count") >= min_count_col)
    )

    sample_window = Window.partitionBy(*trend_group_cols).orderBy("article_id")
    article_id_samples = (
        windowed_terms
        .select(*trend_group_cols, "article_id")
        .dropDuplicates([*trend_group_cols, "article_id"])
        .withColumn("article_rank", row_number().over(sample_window))
        .filter(col("article_rank") <= lit(_MAX_ARTICLE_IDS_PER_TREND))
        .groupBy(*trend_group_cols)
        .agg(collect_list("article_id").alias("article_ids"))
    )

    aggregated_rows = (
        counts
        .join(article_id_samples, trend_group_cols, "left")
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

    aggregated = [row.asDict(recursive=True) for row in aggregated_rows.collect()]
    if not aggregated:
        logger.info(f"batch={batch_id} no trends above threshold — skipping")
        return

    logger.info(f"batch={batch_id} aggregated_trends={len(aggregated)} — scoring")

    # Step 5–6: Compute scores with velocity from previous window. This is done
    # on the reduced aggregate output so the driver only handles sink payloads.
    # Cache previous-count lookups to avoid repeated PG queries
    prev_cache: dict[tuple, dict[str, int]] = {}
    all_trends: list[dict[str, Any]] = []

    for row in aggregated:
        ws_iso = _iso_timestamp(row["window_start"])
        we_iso = _iso_timestamp(row["window_end"])
        scope_type = row["scope_type"]
        scope_value = row["scope_value"]
        term = row["term"]
        term_type = row["term_type"]
        article_ids = row["article_ids"]
        current_count = int(row["current_count"])
        # Fetch previous window counts (1 window back)
        prev_key = (scope_type, scope_value, ws_iso, we_iso)
        if prev_key not in prev_cache:
            # Previous window: shift back by window_size_seconds
            try:
                w_start_dt = datetime.fromisoformat(ws_iso)
                prev_ws = (w_start_dt - timedelta(seconds=window_size_seconds)).isoformat()
                prev_we = ws_iso  # previous window ends where current starts
                prev_cache[prev_key] = fetch_previous_counts(
                    postgres_dsn, prev_ws, prev_we, scope_type, scope_value,
                )
            except Exception:
                prev_cache[prev_key] = {}

        prev_counts = prev_cache[prev_key]
        previous_count = prev_counts.get(f"{term}|{term_type}", 0)
        velocity, score = _compute_score(current_count, previous_count)

        all_trends.append({
            "window_start": ws_iso,
            "window_end": we_iso,
            "scope_type": scope_type,
            "scope_value": scope_value,
            "term": term,
            "term_type": term_type,
            "article_ids": list(article_ids),
            "current_count": current_count,
            "previous_count": previous_count,
            "velocity": velocity,
            "score": score,
        })

    if not all_trends:
        logger.info(f"batch={batch_id} no trends above threshold — skipping")
        return

    # Step 7: Top-N per scope per window
    top_n_limits = {
        "global": top_n_global,
        "country": top_n_country,
        "topic": top_n_topic,
    }

    # Group by (window, scope_type, scope_value) and rank by score descending
    grouped: dict[tuple, list[dict]] = {}
    for t in all_trends:
        gk = (t["window_start"], t["window_end"], t["scope_type"], t["scope_value"])
        grouped.setdefault(gk, []).append(t)

    final_trends: list[dict] = []
    for gk, items in grouped.items():
        scope_type = gk[2]
        limit = top_n_limits.get(scope_type, 50)
        sorted_items = sorted(items, key=lambda x: x["score"], reverse=True)
        final_trends.extend(sorted_items[:limit])

    logger.info(
        f"batch={batch_id} final_trends={len(final_trends)} "
        f"(from {len(all_trends)} above threshold)"
    )

    # Step 8: Write to Redis
    try:
        write_trends_to_redis(
            redis_client, final_trends,
            top_n_global=top_n_global,
            top_n_country=top_n_country,
            top_n_topic=top_n_topic,
        )
    except Exception:
        logger.error(f"batch={batch_id} Redis write failed", exc_info=True)

    # Step 9: Write to Postgres
    try:
        write_trends_to_postgres(postgres_dsn, final_trends)
    except Exception:
        logger.error(f"batch={batch_id} Postgres write failed", exc_info=True)

    elapsed_ms = int((time.time() - t0) * 1000)
    logger.info(
        f"batch={batch_id} done aggregated_trends={len(aggregated)} "
        f"trends_written={len(final_trends)} elapsed_ms={elapsed_ms}"
    )
