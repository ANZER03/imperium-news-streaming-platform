#!/usr/bin/env bash
# Start news-source-db and initialise the schema + publications.
# Safe to re-run: CREATE IF NOT EXISTS / ON_ERROR_STOP for each SQL file.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "${ROOT_DIR}/scripts/lib/processing.sh"

SOURCE_PG_DATABASE="${SOURCE_PG_DATABASE:-imperium-news-source}"
SOURCE_PG_USER="${SOURCE_PG_USER:-postgres}"

compose --profile source up -d news-source-db

echo "Waiting for news-source-db to be ready..."
until compose exec -T news-source-db pg_isready -U "${SOURCE_PG_USER}" -d postgres >/dev/null 2>&1; do
  sleep 1
done

if ! compose exec -T news-source-db \
    psql -U "${SOURCE_PG_USER}" -d postgres -tAc \
    "SELECT 1 FROM pg_database WHERE datname = '${SOURCE_PG_DATABASE}'" | grep -q 1; then
  compose exec -T news-source-db createdb -U "${SOURCE_PG_USER}" "${SOURCE_PG_DATABASE}"
  echo "Created database ${SOURCE_PG_DATABASE}."
fi

for sql_file in \
  "${ROOT_DIR}/infrastructure/postgres/initdb/00_reference_tables.sql" \
  "${ROOT_DIR}/infrastructure/postgres/initdb/01_table_rubrique.sql" \
  "${ROOT_DIR}/infrastructure/postgres/initdb/02_table_links.sql" \
  "${ROOT_DIR}/infrastructure/postgres/initdb/03_table_news.sql" \
  "${ROOT_DIR}/infrastructure/postgres/initdb/04_debezium_signal.sql" \
  "${ROOT_DIR}/infrastructure/postgres/initdb/05_publications.sql" \
  "${ROOT_DIR}/infrastructure/postgres/initdb/06_phase3_cleaned_articles.sql" \
  "${ROOT_DIR}/infrastructure/postgres/initdb/07_phase3_curated_dimensions.sql" \
  "${ROOT_DIR}/infrastructure/postgres/initdb/08_phase3_projection_state.sql"
do
  compose exec -T news-source-db \
    psql -U "${SOURCE_PG_USER}" -d "${SOURCE_PG_DATABASE}" \
    -v ON_ERROR_STOP=1 -f - < "${sql_file}"
  echo "  applied: $(basename "${sql_file}")"
done

echo "Source DB initialised."
