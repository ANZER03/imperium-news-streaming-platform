#!/usr/bin/env python3
"""
Clone an older descending slice of table_news from prod into the local source DB.

Usage:
    python scripts/clone/clone-old-news.py --before-id <id> --size <rows>

Arguments:
    --before-id   Only fetch rows where id < this value
    --size        Number of rows to fetch (ORDER BY id DESC LIMIT <size>)

The minimum imported id is saved to:
    scripts/clone/.state/clone-old-news-min-id.json
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

root_dir = Path(__file__).resolve().parent.parent.parent
sys.path.append(str(root_dir / "scripts" / "clone"))
sys.path.append(str(root_dir / "scripts" / "clone" / "lib"))

from clone_table import news_source_query
from postgres_clone_common import CloneContext

STATE_FILE = root_dir / "scripts" / "clone" / ".state" / "clone-old-news-min-id.json"


def build_query(before_id: int, size: int) -> str:
    base = news_source_query(size)
    select_part = base.split("ORDER BY")[0].strip()
    return f"{select_part}\nWHERE id < {before_id}\nORDER BY id DESC\nLIMIT {size}"


def save_min_id(min_id: int) -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps({"min_id": min_id}, indent=2))
    print(f"Saved min_id={min_id} -> {STATE_FILE}")


def clone_batch(before_id: int, size: int) -> int:
    context = CloneContext.from_project_root(root_dir)
    query = build_query(before_id, size)
    tmp_file = context.config.tmp_dir / "table_news.clone-old-slice.csv"

    meta_sql = f"SELECT COUNT(*), COALESCE(MIN(id), {before_id}) FROM ({query}) AS q"
    output = context.run_source_psql("-AtF", "|", "-c", meta_sql, capture_output=True).stdout.strip()
    row_count_raw, min_id_raw = output.split("|", 1)
    row_count = int(row_count_raw)
    min_id = int(min_id_raw)

    if row_count == 0:
        print(f"No rows found in prod where id < {before_id}. Nothing to import.")
        save_min_id(before_id)
        return 0

    print(f"Fetching {row_count} rows from prod where id < {before_id} ...")
    context.source_copy_query_to_csv(query, tmp_file, with_header=True)

    print("Importing into local source-db (upsert on id conflict) ...")
    context.import_csv_chunk("table_news", tmp_file)
    save_min_id(min_id)

    print(f"Done. rows={row_count} min_id={min_id}")
    return row_count


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Clone older table_news slice from prod")
    parser.add_argument("--before-id", type=int, required=True, help="Fetch rows where id < this value")
    parser.add_argument("--size", type=int, required=True, help="Number of rows to fetch (LIMIT)")
    args = parser.parse_args(argv)

    clone_batch(args.before_id, args.size)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
