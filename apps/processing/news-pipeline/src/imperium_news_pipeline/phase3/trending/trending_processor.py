"""Core trending batch processor.

Called from the Spark driver's ``foreachBatch``.  For each micro-batch of
classified articles, it:

  1. Filters to ``classification_status == 'classified'``
  2. Extracts candidate terms (title words, title bigrams, excerpt words)
  3. Deduplicates per article
  4. Groups into time windows (1h / 5min slide)
  5. Aggregates counts per scope (global, country, topic)
  6. Calculates trending score using velocity from Postgres
  7. Applies minimum thresholds and top-N ranking
  8. Writes results to Redis + Postgres
"""
from __future__ import annotations

import logging
import math
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Mapping, Set

from pyspark.sql import DataFrame

from imperium_news_pipeline.phase3.trending.term_extractor import extract_candidates
from imperium_news_pipeline.phase3.trending.redis_writer import write_trends_to_redis
from imperium_news_pipeline.phase3.trending.postgres_writer import (
    fetch_previous_counts,
    write_trends_to_postgres,
)

logger = logging.getLogger("TrendingProcessor")


def _compute_score(current: int, previous: int) -> tuple[float, float]:
    """Return (velocity, score) per PRD §14."""
    velocity = current / max(previous, 1)
    score = math.log(1 + current) * velocity
    return round(velocity, 4), round(score, 4)


def _window_bounds(event_ts: float, window_seconds: int, slide_seconds: int):
    """Yield (window_start, window_end) datetime pairs that contain event_ts.

    An event belongs to every window whose [start, end) range includes it.
    Windows are aligned to the epoch.
    """
    # Find the latest window-start that is <= event_ts
    latest_start = int(event_ts // slide_seconds) * slide_seconds
    # Walk backwards to find all windows that contain this event
    ws = latest_start
    while ws + window_seconds > event_ts:
        w_start = datetime.fromtimestamp(ws, tz=timezone.utc)
        w_end = datetime.fromtimestamp(ws + window_seconds, tz=timezone.utc)
        yield (w_start, w_end)
        ws -= slide_seconds
        # Safety: don't go back more than one full window
        if latest_start - ws > window_seconds:
            break


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

    # Step 1: Filter classified articles only
    classified = batch_df.filter(
        batch_df["v.classification_status"] == "classified"
    )
    count = classified.count()
    if count == 0:
        logger.info(f"batch={batch_id} classified=0 — skipping")
        return

    logger.info(f"batch={batch_id} classified={count} — extracting terms")

    # Step 2–3: Collect articles and extract candidates on the driver.
    # This is intentional: trending extraction is CPU-light per article and
    # the volume per micro-batch is bounded by maxOffsetsPerTrigger.
    rows = classified.select(
        "event_time",
        "v.article_id",
        "v.title",
        "v.excerpt",
        "v.body_text_clean",
        "v.language_code",
        "v.country_name",
        "v.root_topic_label",
    ).collect()

    # term_records: list of dicts with all fields needed for aggregation
    term_records: list[dict] = []
    for row in rows:
        article_id = row["article_id"]
        event_time = row["event_time"]
        if event_time is None:
            continue
            
        event_ts = event_time.timestamp()

        country = row["country_name"] or "unknown"
        topic = row["root_topic_label"] or "unknown"
        lang = row["language_code"] or "unknown"

        candidates = extract_candidates(
            title=row["title"] or "",
            excerpt=row["excerpt"] or "",
            body_text_clean=row["body_text_clean"] or "",
            language_code=lang,
            stopwords_map=stopwords_map,
            blocked_terms=blocked_terms,
        )

        for term, term_type in candidates:
            term_records.append({
                "article_id": article_id,
                "event_ts": event_ts,
                "country": country,
                "topic": topic,
                "term": term,
                "term_type": term_type,
            })

    if not term_records:
        logger.info(f"batch={batch_id} no term candidates — skipping")
        return

    logger.info(f"batch={batch_id} term_candidates={len(term_records)}")

    # Step 4: Assign windows and aggregate
    # Aggregate structure: (window_start, window_end, scope_type, scope_value, term, term_type) → set of article_ids
    agg: dict[tuple, set[str]] = {}

    for rec in term_records:
        event_ts = rec["event_ts"]
        article_id = rec["article_id"]
        term = rec["term"]
        term_type = rec["term_type"]
        country = rec["country"]
        topic = rec["topic"]

        for w_start, w_end in _window_bounds(event_ts, window_size_seconds, slide_interval_seconds):
            ws_iso = w_start.isoformat()
            we_iso = w_end.isoformat()

            # Global
            gkey = (ws_iso, we_iso, "global", "global", term, term_type)
            agg.setdefault(gkey, set()).add(article_id)

            # Country
            ckey = (ws_iso, we_iso, "country", country, term, term_type)
            agg.setdefault(ckey, set()).add(article_id)

            # Topic
            tkey = (ws_iso, we_iso, "topic", topic, term, term_type)
            agg.setdefault(tkey, set()).add(article_id)

    logger.info(f"batch={batch_id} aggregation_keys={len(agg)}")

    # Step 5–6: Compute scores with velocity from previous window
    # Cache previous-count lookups to avoid repeated PG queries
    prev_cache: dict[tuple, dict[str, int]] = {}
    all_trends: list[dict[str, Any]] = []

    min_counts = {
        "global": global_min_count,
        "country": country_min_count,
        "topic": topic_min_count,
    }

    for (ws_iso, we_iso, scope_type, scope_value, term, term_type), article_ids in agg.items():
        current_count = len(article_ids)

        # Apply minimum threshold
        if current_count < min_counts.get(scope_type, 3):
            continue

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
        f"batch={batch_id} done articles={count} terms={len(term_records)} "
        f"trends_written={len(final_trends)} elapsed_ms={elapsed_ms}"
    )
