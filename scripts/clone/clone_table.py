#!/usr/bin/env python3

from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent / "lib"))

from postgres_clone_common import CloneContext


csv.field_size_limit(sys.maxsize)


NON_NEWS_TABLES = {
    "table_pays",
    "table_langue",
    "table_sedition",
    "table_authority",
    "table_rubrique",
    "table_links",
}


def news_source_query(slice_limit: int) -> str:
    return f"""
        SELECT
            id,
            added_in,
            added_by,
            updated_in,
            updated_by,
            updated,
            link_id,
            COALESCE(more_url, '') AS more_url,
            COALESCE(more_title, '') AS more_title,
            COALESCE(more_inner_text, '') AS more_inner_text,
            COALESCE(more_reporter, '') AS more_reporter,
            COALESCE(more_date_text, '') AS more_date_text,
            COALESCE(more_image_url, '') AS more_image_url,
            COALESCE(more_image_down, false) AS more_image_down,
            COALESCE(more_source_html_down, false) AS more_source_html_down,
            COALESCE(more_hash, '') AS more_hash,
            COALESCE(more_image_extension_id, 0) AS more_image_extension_id,
            COALESCE(more_image_size, 0) AS more_image_size,
            COALESCE(article_id, 0) AS article_id,
            COALESCE(article_applic_contenu_id, 0) AS article_applic_contenu_id,
            COALESCE(langue_id, 0) AS langue_id,
            COALESCE(langue_id_updated, false) AS langue_id_updated,
            COALESCE(more_title_updated, false) AS more_title_updated,
            COALESCE(more_inner_text_updated, false) AS more_inner_text_updated,
            COALESCE(valide, false) AS valide,
            COALESCE(checked, false) AS checked,
            COALESCE(to_delete, false) AS to_delete,
            COALESCE(more_meta_keywords, '') AS more_meta_keywords,
            COALESCE(more_meta_description, '') AS more_meta_description,
            COALESCE(more_trad_fr, '') AS more_trad_fr,
            COALESCE(ss_jpg, false) AS ss_jpg,
            COALESCE(ss_pdf, false) AS ss_pdf,
            COALESCE(ss_jpg_size, 0) AS ss_jpg_size,
            COALESCE(ss_pdf_size, 0) AS ss_pdf_size,
            COALESCE(indexed, false) AS indexed,
            indexed_in,
            COALESCE(rubrique_id, 0) AS rubrique_id,
            COALESCE(rubric_checked, false) AS rubric_checked,
            more_date_checked,
            more_date_error_id,
            more_date_regex_text,
            more_source_html,
            readability,
            ss_rct,
            ss_rct_size,
            authority_id,
            more_video_url,
            indexed_s,
            queried,
            COALESCE(isvideo, false) AS isvideo,
            pubdate,
            crawl_date,
            micro_service_id,
            article_payant
        FROM public.table_news
        ORDER BY id DESC
        LIMIT {slice_limit}
    """


def run_full_table_clone(table_name: str, batch_size: int = 20000) -> int:
    if table_name not in NON_NEWS_TABLES:
        raise SystemExit(f"Unsupported table for full clone: {table_name}")

    root_dir = Path(__file__).resolve().parent.parent.parent
    context = CloneContext.from_project_root(root_dir)
    context.local_execute(f"TRUNCATE public.{table_name} RESTART IDENTITY")

    last_id = int(context.local_scalar(f"SELECT COALESCE(MAX(id), 0) FROM public.{table_name}") or "0")
    tmp_file = context.config.tmp_dir / f"{table_name}.csv"

    while True:
        row_count, next_last_id = context.fetch_chunk_meta(table_name, last_id, batch_size)
        if row_count == 0:
            print(f"Finished {table_name} at id {last_id}")
            return 0

        context.fetch_chunk_csv(table_name, last_id, batch_size, tmp_file)
        context.import_csv_chunk(table_name, tmp_file)
        last_id = next_last_id
        print(f"Imported {row_count} rows into {table_name}, last id {last_id}")


def run_news_clone(
    slice_limit: int = 50000,
    import_limit: int = 46000,
    export_limit: int = 4000,
) -> int:
    root_dir = Path(__file__).resolve().parent.parent.parent
    context = CloneContext.from_project_root(root_dir)

    if import_limit + export_limit > slice_limit:
        raise SystemExit("import-limit + export-limit must not exceed slice-limit")

    table_name = "table_news"
    slice_file = context.config.tmp_dir / f"{table_name}.slice.csv"
    import_file = context.config.tmp_dir / f"{table_name}.import.csv"
    export_file = context.config.export_dir / f"{table_name}.tail.csv"

    context.local_execute(f"TRUNCATE public.{table_name} RESTART IDENTITY")
    import_query = news_source_query(import_limit)
    export_query = news_source_query(slice_limit)
    export_query = export_query.replace(f"LIMIT {slice_limit}", f"OFFSET {import_limit} LIMIT {export_limit}")

    context.source_copy_query_to_csv(import_query, import_file, with_header=True)
    context.source_copy_query_to_csv(export_query, export_file, with_header=True)

    import_rows = int(context.run_source_psql("-Atc", f"SELECT COUNT(*) FROM ({import_query}) AS q", capture_output=True).stdout.strip() or "0")
    export_rows = int(context.run_source_psql("-Atc", f"SELECT COUNT(*) FROM ({export_query}) AS q", capture_output=True).stdout.strip() or "0")

    if import_rows:
        context.import_csv_chunk(table_name, import_file)

    print(f"{table_name}: imported {import_rows} rows into source-db and saved {export_rows} rows to {export_file}")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--table", required=True)
    parser.add_argument("--batch-size", type=int, default=20000)
    parser.add_argument("--slice-limit", type=int, default=50000)
    parser.add_argument("--import-limit", type=int, default=46000)
    parser.add_argument("--export-limit", type=int, default=4000)
    args = parser.parse_args(argv)

    if args.table == "table_news":
        return run_news_clone(args.slice_limit, args.import_limit, args.export_limit)

    return run_full_table_clone(args.table, args.batch_size)


if __name__ == "__main__":
    raise SystemExit(main())
