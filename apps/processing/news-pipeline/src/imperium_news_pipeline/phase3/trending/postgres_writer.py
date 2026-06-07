"""Postgres writer for trending historical snapshots.

Upserts trend records into the ``trend_items`` table using parameterised
queries via psycopg (already in the Spark Docker image).

Uses ON CONFLICT ... DO UPDATE for idempotent retries.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List

import psycopg

from imperium_news_pipeline.phase3.trending.retry import retry

logger = logging.getLogger("TrendingPostgresWriter")

_UPSERT_SQL = """
INSERT INTO trend_items (
    window_start, window_end, scope_type, scope_value,
    term, term_type, article_ids, current_count, previous_count,
    velocity, score
)
VALUES (
    %(window_start)s, %(window_end)s, %(scope_type)s, %(scope_value)s,
    %(term)s, %(term_type)s, %(article_ids)s, %(current_count)s, %(previous_count)s,
    %(velocity)s, %(score)s
)
ON CONFLICT (
    window_start, window_end, scope_type, scope_value, term, term_type
)
DO UPDATE SET
    article_ids    = EXCLUDED.article_ids,
    current_count  = EXCLUDED.current_count,
    previous_count = EXCLUDED.previous_count,
    velocity       = EXCLUDED.velocity,
    score          = EXCLUDED.score,
    created_at     = now()
"""

_PREVIOUS_COUNT_SQL = """
SELECT term, term_type, scope_type, scope_value, current_count
FROM trend_items
WHERE window_start = %(prev_window_start)s
  AND window_end   = %(prev_window_end)s
  AND scope_type   = %(scope_type)s
  AND scope_value  = %(scope_value)s
"""

_BATCH_PREVIOUS_COUNT_SQL = """
SELECT window_start, window_end, scope_type, scope_value,
       term, term_type, current_count
FROM trend_items
WHERE (window_start, window_end, scope_type, scope_value)
      IN (VALUES {placeholders})
"""


def _iso_timestamp(value: Any) -> str:
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


@retry(max_attempts=3, base_delay=1.0, retryable=(psycopg.OperationalError,))
def fetch_previous_counts(
    dsn: str,
    prev_window_start: str,
    prev_window_end: str,
    scope_type: str,
    scope_value: str,
) -> Dict[str, int]:
    """Fetch previous window counts for velocity calculation.

    Returns a dict keyed by ``(term, term_type)`` → ``current_count``.
    """
    result: dict[str, int] = {}
    try:
        with psycopg.connect(dsn, autocommit=True) as conn:
            with conn.cursor() as cur:
                cur.execute(_PREVIOUS_COUNT_SQL, {
                    "prev_window_start": prev_window_start,
                    "prev_window_end": prev_window_end,
                    "scope_type": scope_type,
                    "scope_value": scope_value,
                })
                for row in cur.fetchall():
                    term, term_type, _, _, count = row
                    result[f"{term}|{term_type}"] = count
    except psycopg.OperationalError:
        raise  # let retry handle it
    except Exception:
        logger.warning(
            "Could not fetch previous counts for velocity — defaulting to 0",
            exc_info=True,
        )
    return result


@retry(max_attempts=3, base_delay=1.0, retryable=(psycopg.OperationalError,))
def fetch_all_previous_counts(
    dsn: str,
    scope_keys: list,
    window_size_seconds: int,
) -> list[dict[str, Any]]:
    """Batch-fetch previous counts for all scope keys in a single query.

    Args:
        dsn: Postgres connection string.
        scope_keys: List of Row objects with window_start, window_end,
                    scope_type, scope_value.
        window_size_seconds: Window size to shift back for previous window.

    Returns:
        List of dicts with: window_start, window_end, scope_type,
        scope_value, term, term_type, previous_count.
        The window_start/window_end in the output refer to the *current*
        window (shifted forward), so they can be joined directly with the
        counts DataFrame.
    """
    if not scope_keys:
        return []

    # Build (prev_window_start, prev_window_end, scope_type, scope_value) tuples
    prev_keys: list[tuple[str, str, str, str]] = []
    # Map from prev key → current key (for re-mapping window back to current)
    prev_to_current: dict[tuple[str, str, str, str], tuple[str, str]] = {}

    for row in scope_keys:
        ws = row["window_start"]
        we = row["window_end"]
        scope_type = row["scope_type"]
        scope_value = row["scope_value"]

        ws_dt = ws if isinstance(ws, datetime) else datetime.fromisoformat(str(ws))
        prev_ws = (ws_dt - timedelta(seconds=window_size_seconds)).isoformat()
        prev_we = _iso_timestamp(ws)  # previous window ends where current starts

        prev_key = (prev_ws, prev_we, scope_type, scope_value)
        if prev_key not in prev_to_current:
            prev_keys.append(prev_key)
            prev_to_current[prev_key] = (_iso_timestamp(ws), _iso_timestamp(we))

    if not prev_keys:
        return []

    results: list[dict[str, Any]] = []
    try:
        with psycopg.connect(dsn, autocommit=True) as conn:
            with conn.cursor() as cur:
                # Chunk prev_keys to avoid Postgres parameter limit (65535)
                # 4 parameters per key, so max safe chunk size is ~16000. Use 10000.
                CHUNK_SIZE = 10000
                for chunk_idx in range(0, len(prev_keys), CHUNK_SIZE):
                    chunk = prev_keys[chunk_idx : chunk_idx + CHUNK_SIZE]

                    value_parts = []
                    params: dict[str, str] = {}
                    for i, (pws, pwe, st, sv) in enumerate(chunk):
                        value_parts.append(
                            f"(%(ws_{i})s::timestamptz, %(we_{i})s::timestamptz, "
                            f"%(st_{i})s, %(sv_{i})s)"
                        )
                        params[f"ws_{i}"] = pws
                        params[f"we_{i}"] = pwe
                        params[f"st_{i}"] = st
                        params[f"sv_{i}"] = sv

                    query = _BATCH_PREVIOUS_COUNT_SQL.format(
                        placeholders=", ".join(value_parts)
                    )
                    cur.execute(query, params)

                    for db_row in cur.fetchall():
                        db_ws, db_we, db_st, db_sv, term, term_type, count = db_row
                        prev_key = (
                            _iso_timestamp(db_ws),
                            _iso_timestamp(db_we),
                            db_st,
                            db_sv,
                        )
                        current_ws, current_we = prev_to_current.get(
                            prev_key, (str(db_ws), str(db_we))
                    )
                    results.append({
                        "window_start": current_ws,
                        "window_end": current_we,
                        "scope_type": db_st,
                        "scope_value": db_sv,
                        "term": term,
                        "term_type": term_type,
                        "previous_count": int(count),
                    })
    except psycopg.OperationalError:
        raise  # let retry handle it
    except Exception:
        logger.warning(
            "Could not batch-fetch previous counts — defaulting to 0",
            exc_info=True,
        )

    logger.info(f"Postgres: fetched {len(results)} previous count rows for {len(prev_keys)} scope keys")
    return results


@retry(max_attempts=3, base_delay=1.0, retryable=(psycopg.OperationalError,))
def write_trends_to_postgres(
    dsn: str,
    trends: List[Dict[str, Any]],
) -> int:
    """Upsert a batch of trend records into ``trend_items``.

    Returns the number of rows upserted.
    """
    if not trends:
        return 0

    written = 0
    try:
        with psycopg.connect(dsn) as conn:
            with conn.cursor() as cur:
                params_list = [
                    {
                        "window_start": t["window_start"],
                        "window_end": t["window_end"],
                        "scope_type": t["scope_type"],
                        "scope_value": t["scope_value"],
                        "term": t["term"],
                        "term_type": t["term_type"],
                        "article_ids": t.get("article_ids", []),
                        "current_count": t["current_count"],
                        "previous_count": t["previous_count"],
                        "velocity": t["velocity"],
                        "score": t["score"],
                    }
                    for t in trends
                ]
                cur.executemany(_UPSERT_SQL, params_list)
                written = len(params_list)
            conn.commit()
    except psycopg.OperationalError:
        raise  # let retry handle it
    except Exception:
        logger.error("Postgres upsert failed", exc_info=True)
        raise

    logger.info(f"Postgres: upserted {written} trend rows")
    return written
