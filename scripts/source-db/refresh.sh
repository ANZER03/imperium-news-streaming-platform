#!/usr/bin/env bash
# Drop Debezium publications and signal table, then re-apply SQL 04 + 05.
# Use this after schema changes that require re-registering WAL publications.
# Table data (table_news, reference tables) is preserved.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "${ROOT_DIR}/scripts/lib/processing.sh"

pg_exec <<'SQL'
DROP PUBLICATION IF EXISTS imperium_reference_publication;
DROP PUBLICATION IF EXISTS imperium_metadata_publication;
DROP PUBLICATION IF EXISTS imperium_news_publication;
DROP TABLE IF EXISTS public.debezium_signal;
SQL

for sql_file in \
  "${ROOT_DIR}/infrastructure/postgres/initdb/04_debezium_signal.sql" \
  "${ROOT_DIR}/infrastructure/postgres/initdb/05_publications.sql"
do
  pg_exec -f /dev/stdin < "${sql_file}"
  echo "  applied: $(basename "${sql_file}")"
done

echo "Source DB support objects refreshed. Table data was preserved."
