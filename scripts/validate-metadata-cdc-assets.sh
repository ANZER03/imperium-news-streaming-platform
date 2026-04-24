#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONNECTOR_FILE="$ROOT_DIR/apps/ingestion/connector-bootstrap/metadata/metadata-connector.json"
REGISTER_SCRIPT="$ROOT_DIR/apps/ingestion/connector-bootstrap/metadata/register-metadata-connector.sh"
TOPIC_SCRIPT="$ROOT_DIR/apps/ingestion/topic-bootstrap/metadata/bootstrap-metadata-topics.sh"
RESET_SCRIPT="$ROOT_DIR/apps/ingestion/topic-bootstrap/metadata/reset-metadata-signal-topic.sh"
SIGNAL_SCRIPT="$ROOT_DIR/apps/ingestion/connector-bootstrap/metadata/emit-full-backfill-signal.sh"
SIGNAL_FILE="$ROOT_DIR/apps/ingestion/connector-bootstrap/metadata/full-backfill-signal.json"
GUARD_SCRIPT="$ROOT_DIR/apps/ingestion/connector-bootstrap/common/connect-signal-guard.sh"
AUTHORITY_SINK="$ROOT_DIR/apps/ingestion/sink-templates/metadata/table-authority-sink.json"
LINKS_SINK="$ROOT_DIR/apps/ingestion/sink-templates/metadata/table-links-sink.json"

fail() {
  printf '%s\n' "$1" >&2
  exit 1
}

for file in "$CONNECTOR_FILE" "$REGISTER_SCRIPT" "$TOPIC_SCRIPT" "$RESET_SCRIPT" "$SIGNAL_SCRIPT" "$SIGNAL_FILE" "$GUARD_SCRIPT" "$AUTHORITY_SINK" "$LINKS_SINK"; do
  [[ -f "$file" ]] || fail "missing metadata CDC asset: $file"
done

grep -q '"snapshot.mode": "never"' "$CONNECTOR_FILE" || fail "metadata connector must use never snapshot mode for incremental backfill"
grep -q '"signal.enabled.channels": "source,kafka"' "$CONNECTOR_FILE" || fail "metadata connector must use Kafka signals"
grep -q '"signal.kafka.topic": "${METADATA_CDC_SIGNAL_TOPIC}"' "$CONNECTOR_FILE" || fail "metadata connector must define a signal topic"
grep -q '"table.include.list": "${METADATA_CDC_TABLES}"' "$CONNECTOR_FILE" || fail "metadata connector must include the metadata tables"
grep -q '"incremental.snapshot.chunk.size": "${METADATA_CDC_INCREMENTAL_SNAPSHOT_CHUNK_SIZE}"' "$CONNECTOR_FILE" || fail "metadata connector must define an incremental snapshot chunk size"
grep -q 'require_empty_signal_topic' "$REGISTER_SCRIPT" || fail "metadata connector registration must guard against retained signal replay"
grep -q '"id": "${CDC_SIGNAL_ID}"' "$SIGNAL_FILE" || fail "metadata signal payload must accept a generated signal id"
grep -q 'CDC_SIGNAL_ID' "$SIGNAL_SCRIPT" || fail "metadata signal emitter must generate unique signal ids"

for topic in \
  'imperium.metadata.public.table_authority' \
  'imperium.metadata.public.table_links' \
  'imperium.metadata.public.debezium_signal' \
  'imperium.metadata.schema-history' \
  'imperium.metadata.signals' \
  '__debezium-heartbeat.imperium.metadata'; do
  grep -q "$topic" "$TOPIC_SCRIPT" || fail "metadata topic bootstrap missing $topic"
done

grep -q '"topics": "imperium.metadata.public.table_authority"' "$AUTHORITY_SINK" || fail "authority sink template must target the authority topic"
grep -q '"topics": "imperium.metadata.public.table_links"' "$LINKS_SINK" || fail "links sink template must target the links topic"
grep -q '"insert.mode": "upsert"' "$AUTHORITY_SINK" || fail "authority sink template must upsert"
grep -q '"insert.mode": "upsert"' "$LINKS_SINK" || fail "links sink template must upsert"

grep -q '^METADATA_CDC_CONNECTOR_NAME=imperium-metadata-cdc$' "$ROOT_DIR/.env.example" || fail "missing metadata CDC env vars"
grep -q '^METADATA_CDC_TABLES=public.table_authority,public.table_links$' "$ROOT_DIR/.env.example" || fail "missing metadata CDC table list"
grep -q '^METADATA_CDC_INCREMENTAL_SNAPSHOT_CHUNK_SIZE=8192$' "$ROOT_DIR/.env.example" || fail "missing metadata CDC incremental snapshot chunk size"
grep -q '^METADATA_SINK_AUTHORITY_NAME=imperium-metadata-authority-sink$' "$ROOT_DIR/.env.example" || fail "missing authority sink env var"
grep -q '^METADATA_SINK_LINKS_NAME=imperium-metadata-links-sink$' "$ROOT_DIR/.env.example" || fail "missing links sink env var"
