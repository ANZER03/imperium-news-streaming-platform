#!/usr/bin/env python3
"""
Bulk-clone a large slice of table_news from prod (default 100k rows).

Usage:
    python scripts/clone/bulk.py [--start-id <id>] [--limit <rows>]

Arguments:
    --start-id   Fetch rows where id > this value (default 565170965)
    --limit      Number of rows to fetch (default 100000)

Exports to scripts/clone/exports/table_news.tail.csv and imports into local source-db.
"""

from __future__ import annotations

import argparse
from pathlib import Path
import sys

root_dir = Path(__file__).resolve().parent.parent.parent
sys.path.append(str(root_dir / "scripts" / "clone"))
sys.path.append(str(root_dir / "scripts" / "clone" / "lib"))

from clone_table import news_source_query
from postgres_clone_common import CloneContext


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Bulk-clone table_news from prod")
    parser.add_argument("--start-id", type=int, default=565170965)
    parser.add_argument("--limit", type=int, default=100000)
    args = parser.parse_args(argv)

    context = CloneContext.from_project_root(root_dir)
    export_file = context.config.export_dir / "table_news.tail.csv"
    import_file = context.config.tmp_dir / "table_news.100k.csv"

    base_query = news_source_query(args.limit)
    select_part = base_query.split("ORDER BY")[0].strip()
    custom_query = (
        f"{select_part}\n"
        f"WHERE id > {args.start_id}\n"
        f"ORDER BY id ASC\n"
        f"LIMIT {args.limit}"
    )

    print(f"Cloning {args.limit} rows from prod where id > {args.start_id}...")
    context.source_copy_query_to_csv(custom_query, export_file, with_header=True)
    print(f"Exported to {export_file}")

    print("Importing to local DB (APPEND)...")
    context.import_csv_chunk("table_news", export_file)

    print(f"Done. Imported up to {args.limit} rows.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
