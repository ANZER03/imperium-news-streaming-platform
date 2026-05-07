#!/usr/bin/env python3
"""
Import a table_news CSV export into the local source DB.

Usage:
    python scripts/seed/import-csv.py [--csv <path>] [--dsn <dsn>]

Defaults:
    --csv   scripts/clone/exports/table_news.tail.csv
    --dsn   postgresql://postgres:postgres@localhost:35432/imperium-news-source

Environment variables:
    DB_DSN    override connection string
    CSV_PATH  override CSV file path
"""

from __future__ import annotations

import argparse
import csv
import os
import sys
from pathlib import Path

import psycopg

ROOT_DIR = Path(__file__).resolve().parent.parent.parent

DEFAULT_DSN = os.environ.get(
    "DB_DSN",
    "postgresql://postgres:postgres@localhost:35432/imperium-news-source",
)
DEFAULT_CSV = os.environ.get(
    "CSV_PATH",
    str(ROOT_DIR / "scripts" / "clone" / "exports" / "table_news.tail.csv"),
)

NOT_NULL_STRINGS = {
    "more_url", "more_title", "more_inner_text", "more_reporter",
    "more_date_text", "more_image_url", "more_hash",
    "more_meta_keywords", "more_meta_description", "more_trad_fr",
}

csv.field_size_limit(sys.maxsize)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Import table_news CSV into local source DB")
    parser.add_argument("--csv", default=DEFAULT_CSV)
    parser.add_argument("--dsn", default=DEFAULT_DSN)
    args = parser.parse_args(argv)

    if not Path(args.csv).exists():
        print(f"Error: CSV file not found at {args.csv}")
        return 1

    print(f"Connecting to {args.dsn}...")
    with psycopg.connect(args.dsn) as conn:
        with conn.cursor() as cur:
            with open(args.csv, mode="r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                columns = reader.fieldnames
                placeholders = ", ".join(["%s"] * len(columns))
                non_id_cols = ", ".join(
                    f"{c}=EXCLUDED.{c}" for c in columns if c != "id"
                )
                query = (
                    f"INSERT INTO table_news ({', '.join(columns)}) "
                    f"VALUES ({placeholders}) ON CONFLICT (id) DO UPDATE SET {non_id_cols}"
                )

                count = 0
                for row in reader:
                    values = []
                    for col in columns:
                        val = row[col]
                        if val.lower() == "t":
                            values.append(True)
                        elif val.lower() == "f":
                            values.append(False)
                        elif val == "":
                            values.append("" if col in NOT_NULL_STRINGS else None)
                        else:
                            values.append(val)
                    cur.execute(query, values)
                    count += 1
                    if count % 1000 == 0:
                        print(f"Inserted {count} rows...")

                conn.commit()
                print(f"Done. Total rows processed: {count}")
    Path(args.csv).unlink(missing_ok=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
