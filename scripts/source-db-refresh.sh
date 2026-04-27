#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "${ROOT_DIR}/scripts/cdc-lib.sh"

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
done

echo "Source DB support objects refreshed. Source public.table_* rows were preserved."
