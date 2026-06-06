"""Postgres writer for trending historical snapshots.

Upserts trend records into the ``trend_items`` table using parameterised
queries via psycopg (already in the Spark Docker image).

Uses ON CONFLICT ... DO UPDATE for idempotent retries.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List

import psycopg

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
    except Exception:
        logger.warning(
            "Could not fetch previous counts for velocity — defaulting to 0",
            exc_info=True,
        )
    return result


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
                for t in trends:
                    cur.execute(_UPSERT_SQL, {
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
                    })
                    written += 1
            conn.commit()
    except Exception:
        logger.error("Postgres upsert failed", exc_info=True)
        raise

    logger.info(f"Postgres: upserted {written} trend rows")
    return written
