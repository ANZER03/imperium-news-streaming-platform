#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if command -v docker-compose >/dev/null 2>&1; then
  DOCKER_COMPOSE=(docker-compose)
else
  DOCKER_COMPOSE=(docker compose)
fi

SOURCE_PG_DATABASE="${SOURCE_PG_DATABASE:-imperium-news-source}"
SOURCE_PG_USER="${SOURCE_PG_USER:-postgres}"
SOURCE_PG_PASSWORD="${SOURCE_PG_PASSWORD:-postgres}"
SOURCE_PG_EXTERNAL_PORT="${SOURCE_PG_EXTERNAL_PORT:-35432}"

"${DOCKER_COMPOSE[@]}" --profile source up -d postgres-source

until "${DOCKER_COMPOSE[@]}" exec -T postgres-source pg_isready -U "$SOURCE_PG_USER" -d postgres >/dev/null 2>&1; do
  sleep 1
done

if ! "${DOCKER_COMPOSE[@]}" exec -T postgres-source psql -U "$SOURCE_PG_USER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$SOURCE_PG_DATABASE'" | grep -q 1; then
  "${DOCKER_COMPOSE[@]}" exec -T postgres-source createdb -U "$SOURCE_PG_USER" "$SOURCE_PG_DATABASE"
fi

for sql_file in \
  "$ROOT_DIR/infrastructure/postgres/initdb/00_reference_tables.sql" \
  "$ROOT_DIR/infrastructure/postgres/initdb/01_table_rubrique.sql" \
  "$ROOT_DIR/infrastructure/postgres/initdb/02_table_links.sql" \
  "$ROOT_DIR/infrastructure/postgres/initdb/03_table_news.sql" \
  "$ROOT_DIR/infrastructure/postgres/initdb/04_debezium_signal.sql"
do
  "${DOCKER_COMPOSE[@]}" exec -T postgres-source psql -U "$SOURCE_PG_USER" -d "$SOURCE_PG_DATABASE" -v ON_ERROR_STOP=1 -f - < "$sql_file"
done

"${DOCKER_COMPOSE[@]}" exec -T postgres-source psql -U "$SOURCE_PG_USER" -d "$SOURCE_PG_DATABASE" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'imperium_reference_publication') THEN
    CREATE PUBLICATION imperium_reference_publication FOR TABLE public.table_pays, public.table_langue, public.table_rubrique, public.table_sedition;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'imperium_metadata_publication') THEN
    CREATE PUBLICATION imperium_metadata_publication FOR TABLE public.table_authority, public.table_links, public.debezium_signal;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'imperium_news_publication') THEN
    CREATE PUBLICATION imperium_news_publication FOR TABLE public.table_news, public.debezium_signal;
  END IF;
END
$$;
SQL
