#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONNECTOR_FILE="$ROOT_DIR/apps/ingestion/connector-bootstrap/reference/reference-connector.json"
REGISTER_SCRIPT="$ROOT_DIR/apps/ingestion/connector-bootstrap/reference/register-reference-connector.sh"
TOPIC_SCRIPT="$ROOT_DIR/apps/ingestion/topic-bootstrap/reference/bootstrap-reference-topics.sh"

fail() {
  printf '%s\n' "$1" >&2
  exit 1
}

[[ -f "$CONNECTOR_FILE" ]] || fail "missing reference connector manifest"
[[ -f "$REGISTER_SCRIPT" ]] || fail "missing reference connector registration script"
[[ -f "$TOPIC_SCRIPT" ]] || fail "missing reference topic bootstrap script"

grep -q '"snapshot.mode": "initial_only"' "$CONNECTOR_FILE" || fail "reference connector must use initial_only snapshot mode"
grep -q '"publication.autocreate.mode": "disabled"' "$CONNECTOR_FILE" || fail "reference connector must keep publication creation manual"
grep -q '"table.include.list": "${REFERENCE_CDC_TABLES}"' "$CONNECTOR_FILE" || fail "reference connector must include the agreed reference tables"
grep -q '"schema.history.internal.kafka.topic": "${REFERENCE_CDC_SCHEMA_HISTORY_TOPIC}"' "$CONNECTOR_FILE" || fail "reference connector must define a schema history topic"

for topic in \
  'imperium.reference.public.table_pays' \
  'imperium.reference.public.table_langue' \
  'imperium.reference.public.table_rubrique' \
  'imperium.reference.public.table_sedition' \
  'imperium.reference.schema-history'; do
  grep -q "$topic" "$TOPIC_SCRIPT" || fail "topic bootstrap missing $topic"
done

grep -q '^REFERENCE_CDC_CONNECTOR_NAME=imperium-reference-cdc$' "$ROOT_DIR/.env.example" || fail "missing reference CDC env vars"
grep -q '^REFERENCE_CDC_TABLES=public.table_pays,public.table_langue,public.table_rubrique,public.table_sedition$' "$ROOT_DIR/.env.example" || fail "missing reference CDC table list"
