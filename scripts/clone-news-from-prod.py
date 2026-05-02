#!/usr/bin/env python3
"""
Clone a slice of table_news from prod into the local postgres-source.

Usage:
    python scripts/clone-news-from-prod.py --from-id <id> --size <rows>

Arguments:
    --from-id   Only fetch rows where id > this value
    --size      Number of rows to fetch (ORDER BY id ASC LIMIT <size>)

The last imported id is saved to:
    infra/source-db-clone/.state/clone-news-last-id.json
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

root_dir = Path(__file__).resolve().parent.parent
sys.path.append(str(root_dir / "infra" / "source-db-clone"))
sys.path.append(str(root_dir / "infra" / "source-db-clone" / "lib"))

from clone_table import news_source_query
from postgres_clone_common import CloneContext

STATE_FILE = root_dir / "infra" / "source-db-clone" / ".state" / "clone-news-last-id.json"


def build_query(from_id: int, size: int) -> str:
    # Reuse the exact SELECT columns from news_source_query, strip ORDER BY / LIMIT
    base = news_source_query(size)
    select_part = base.split("ORDER BY")[0].strip()
    return f"{select_part}\nWHERE id > {from_id}\nORDER BY id ASC\nLIMIT {size}"


def save_last_id(last_id: int) -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps({"last_id": last_id}, indent=2))
    print(f"Saved last_id={last_id} → {STATE_FILE}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Clone table_news slice from prod")
    parser.add_argument("--from-id", type=int, required=True, help="Fetch rows where id > this value")
    parser.add_argument("--size", type=int, required=True, help="Number of rows to fetch (LIMIT)")
    args = parser.parse_args(argv)

    context = CloneContext.from_project_root(root_dir)

    query = build_query(args.from_id, args.size)
    tmp_file = context.config.tmp_dir / "table_news.clone-slice.csv"

    print(f"Fetching up to {args.size} rows from prod where id > {args.from_id} ...")
    context.source_copy_query_to_csv(query, tmp_file, with_header=True)

    print(f"Importing into local source-db (APPEND, skip conflicts) ...")
    context.import_csv_chunk("table_news", tmp_file)

    # Resolve the actual last id that landed
    last_id = int(
        context.local_scalar("SELECT COALESCE(MAX(id), 0) FROM public.table_news") or "0"
    )
    save_last_id(last_id)

    print(f"Done. Local table_news max id is now {last_id}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
