#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMP_DB_CONTAINER="${TEMP_DB_CONTAINER:-imperium-sink-test-db}"
TEMP_DB_IMAGE="${TEMP_DB_IMAGE:-postgres:15}"
TEMP_DB_NETWORK="${TEMP_DB_NETWORK:-imperium-net}"
TARGET_PG_HOST="${TARGET_PG_HOST:-$TEMP_DB_CONTAINER}"
TARGET_PG_PORT="${TARGET_PG_PORT:-5432}"
TARGET_PG_DATABASE="${TARGET_PG_DATABASE:-imperium_sink_test}"
TARGET_PG_USER="${TARGET_PG_USER:-sink_user}"
TARGET_PG_PASSWORD="${TARGET_PG_PASSWORD:-sink_password}"
TARGET_PG_EXTERNAL_PORT="${TARGET_PG_EXTERNAL_PORT:-35433}"

if ! docker ps -a --format '{{.Names}}' | grep -qx "$TEMP_DB_CONTAINER"; then
  docker run -d \
    --name "$TEMP_DB_CONTAINER" \
    --network "$TEMP_DB_NETWORK" \
    -p "${TARGET_PG_EXTERNAL_PORT}:5432" \
    -e POSTGRES_DB="$TARGET_PG_DATABASE" \
    -e POSTGRES_USER="$TARGET_PG_USER" \
    -e POSTGRES_PASSWORD="$TARGET_PG_PASSWORD" \
    "$TEMP_DB_IMAGE"
fi

docker start "$TEMP_DB_CONTAINER" >/dev/null 2>&1 || true

until docker exec "$TEMP_DB_CONTAINER" pg_isready -U "$TARGET_PG_USER" -d "$TARGET_PG_DATABASE" >/dev/null 2>&1; do
  sleep 1
done

docker exec -i "$TEMP_DB_CONTAINER" psql -U "$TARGET_PG_USER" -d "$TARGET_PG_DATABASE" -v ON_ERROR_STOP=1 \
  < "$ROOT_DIR/infrastructure/postgres/initdb/05_temp_sink_tables.sql"

printf 'Temp sink DB ready at %s:%s/%s\n' "$TARGET_PG_HOST" "$TARGET_PG_PORT" "$TARGET_PG_DATABASE"
