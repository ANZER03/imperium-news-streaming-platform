#!/usr/bin/env bash
# Validates that all CDC connector configs, topic bootstrap scripts, and .env.example
# are consistent with the expected settings. Runs all three domains and reports all failures.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FAIL=0

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  FAIL=1
}

check_file() {
  [[ -f "$1" ]] || fail "missing file: $1"
}

# ── Reference CDC ─────────────────────────────────────────────────────────────
echo "Validating reference CDC assets..."

CONNECTOR_FILE="${ROOT_DIR}/apps/ingestion/connector-bootstrap/reference/reference-connector.json"
REGISTER_SCRIPT="${ROOT_DIR}/apps/ingestion/connector-bootstrap/reference/register-reference-connector.sh"
TOPIC_SCRIPT="${ROOT_DIR}/apps/ingestion/topic-bootstrap/reference/bootstrap-reference-topics.sh"

check_file "${CONNECTOR_FILE}"
check_file "${REGISTER_SCRIPT}"
check_file "${TOPIC_SCRIPT}"

grep -q '"snapshot.mode": "initial_only"' "${CONNECTOR_FILE}" || fail "reference connector must use initial_only snapshot mode"
grep -q '"publication.autocreate.mode": "disabled"' "${CONNECTOR_FILE}" || fail "reference connector must keep publication creation manual"
grep -q '"table.include.list": "${REFERENCE_CDC_TABLES}"' "${CONNECTOR_FILE}" || fail "reference connector must include the reference tables"
grep -q '"schema.history.internal.kafka.topic": "${REFERENCE_CDC_SCHEMA_HISTORY_TOPIC}"' "${CONNECTOR_FILE}" || fail "reference connector must define a schema history topic"

for topic in \
  'imperium.reference.public.table_pays' \
  'imperium.reference.public.table_langue' \
  'imperium.reference.public.table_rubrique' \
  'imperium.reference.public.table_sedition' \
  'imperium.reference.schema-history'; do
  grep -q "${topic}" "${TOPIC_SCRIPT}" || fail "reference topic bootstrap missing ${topic}"
done

grep -q '^REFERENCE_CDC_CONNECTOR_NAME=imperium-reference-cdc$' "${ROOT_DIR}/.env.example" || fail "missing REFERENCE_CDC_CONNECTOR_NAME in .env.example"
grep -q '^REFERENCE_CDC_TABLES=public.table_pays,public.table_langue,public.table_rubrique,public.table_sedition$' "${ROOT_DIR}/.env.example" || fail "missing REFERENCE_CDC_TABLES in .env.example"

# ── Metadata CDC ──────────────────────────────────────────────────────────────
echo "Validating metadata CDC assets..."

CONNECTOR_FILE="${ROOT_DIR}/apps/ingestion/connector-bootstrap/metadata/metadata-connector.json"
REGISTER_SCRIPT="${ROOT_DIR}/apps/ingestion/connector-bootstrap/metadata/register-metadata-connector.sh"
TOPIC_SCRIPT="${ROOT_DIR}/apps/ingestion/topic-bootstrap/metadata/bootstrap-metadata-topics.sh"
SIGNAL_SCRIPT="${ROOT_DIR}/apps/ingestion/connector-bootstrap/metadata/emit-full-backfill-signal.sh"
SIGNAL_FILE="${ROOT_DIR}/apps/ingestion/connector-bootstrap/metadata/full-backfill-signal.json"
GUARD_SCRIPT="${ROOT_DIR}/apps/ingestion/connector-bootstrap/common/connect-signal-guard.sh"
AUTHORITY_SINK="${ROOT_DIR}/apps/ingestion/sink-templates/metadata/table-authority-sink.json"
LINKS_SINK="${ROOT_DIR}/apps/ingestion/sink-templates/metadata/table-links-sink.json"

for file in "${CONNECTOR_FILE}" "${REGISTER_SCRIPT}" "${TOPIC_SCRIPT}" "${SIGNAL_SCRIPT}" "${SIGNAL_FILE}" "${GUARD_SCRIPT}" "${AUTHORITY_SINK}" "${LINKS_SINK}"; do
  check_file "${file}"
done

grep -q '"snapshot.mode": "never"' "${CONNECTOR_FILE}" || fail "metadata connector must use never snapshot mode"
grep -q '"signal.enabled.channels": "source,kafka"' "${CONNECTOR_FILE}" || fail "metadata connector must use Kafka signals"
grep -q '"signal.kafka.topic": "${METADATA_CDC_SIGNAL_TOPIC}"' "${CONNECTOR_FILE}" || fail "metadata connector must define a signal topic"
grep -q '"table.include.list": "${METADATA_CDC_TABLES}"' "${CONNECTOR_FILE}" || fail "metadata connector must include the metadata tables"
grep -q '"incremental.snapshot.chunk.size": "${METADATA_CDC_INCREMENTAL_SNAPSHOT_CHUNK_SIZE}"' "${CONNECTOR_FILE}" || fail "metadata connector must define an incremental snapshot chunk size"
grep -q 'require_empty_signal_topic' "${REGISTER_SCRIPT}" || fail "metadata connector registration must guard against retained signal replay"
grep -q '"id": "${CDC_SIGNAL_ID}"' "${SIGNAL_FILE}" || fail "metadata signal payload must accept a generated signal id"
grep -q 'CDC_SIGNAL_ID' "${SIGNAL_SCRIPT}" || fail "metadata signal emitter must generate unique signal ids"

for topic in \
  'imperium.metadata.public.table_authority' \
  'imperium.metadata.public.table_links' \
  'imperium.metadata.public.debezium_signal' \
  'imperium.metadata.schema-history' \
  'imperium.metadata.signals' \
  '__debezium-heartbeat.imperium.metadata'; do
  grep -q "${topic}" "${TOPIC_SCRIPT}" || fail "metadata topic bootstrap missing ${topic}"
done

grep -q '"topics": "imperium.metadata.public.table_authority"' "${AUTHORITY_SINK}" || fail "authority sink must target the authority topic"
grep -q '"topics": "imperium.metadata.public.table_links"' "${LINKS_SINK}" || fail "links sink must target the links topic"
grep -q '"insert.mode": "upsert"' "${AUTHORITY_SINK}" || fail "authority sink must upsert"
grep -q '"insert.mode": "upsert"' "${LINKS_SINK}" || fail "links sink must upsert"

grep -q '^METADATA_CDC_CONNECTOR_NAME=imperium-metadata-cdc$' "${ROOT_DIR}/.env.example" || fail "missing METADATA_CDC_CONNECTOR_NAME in .env.example"
grep -q '^METADATA_CDC_TABLES=public.table_authority,public.table_links$' "${ROOT_DIR}/.env.example" || fail "missing METADATA_CDC_TABLES in .env.example"
grep -q '^METADATA_CDC_INCREMENTAL_SNAPSHOT_CHUNK_SIZE=8192$' "${ROOT_DIR}/.env.example" || fail "missing METADATA_CDC_INCREMENTAL_SNAPSHOT_CHUNK_SIZE in .env.example"

# ── News CDC ──────────────────────────────────────────────────────────────────
echo "Validating news CDC assets..."

CONNECTOR_FILE="${ROOT_DIR}/apps/ingestion/connector-bootstrap/news/news-connector.json"
REGISTER_SCRIPT="${ROOT_DIR}/apps/ingestion/connector-bootstrap/news/register-news-connector.sh"
SIGNAL_SCRIPT="${ROOT_DIR}/apps/ingestion/connector-bootstrap/news/emit-recent-backfill-signal.sh"
SIGNAL_FILE="${ROOT_DIR}/apps/ingestion/connector-bootstrap/news/recent-backfill-signal.json"
TOPIC_SCRIPT="${ROOT_DIR}/apps/ingestion/topic-bootstrap/news/bootstrap-news-topics.sh"
GUARD_SCRIPT="${ROOT_DIR}/apps/ingestion/connector-bootstrap/common/connect-signal-guard.sh"

for file in "${CONNECTOR_FILE}" "${REGISTER_SCRIPT}" "${SIGNAL_SCRIPT}" "${SIGNAL_FILE}" "${TOPIC_SCRIPT}" "${GUARD_SCRIPT}"; do
  check_file "${file}"
done

grep -q '"snapshot.mode": "never"' "${CONNECTOR_FILE}" || fail "news connector must avoid historical snapshotting"
grep -q '"signal.enabled.channels": "source,kafka"' "${CONNECTOR_FILE}" || fail "news connector must use Kafka signals"
grep -q '"signal.kafka.topic": "${NEWS_CDC_SIGNAL_TOPIC}"' "${CONNECTOR_FILE}" || fail "news connector must define a signal topic"
grep -q '"table.include.list": "${NEWS_CDC_TABLE}"' "${CONNECTOR_FILE}" || fail "news connector must target table_news only"
grep -q 'require_empty_signal_topic' "${REGISTER_SCRIPT}" || fail "news connector registration must guard against retained signal replay"
grep -q '"type": "execute-snapshot"' "${SIGNAL_FILE}" || fail "news signal payload must request a snapshot"
grep -q '"type": "INCREMENTAL"' "${SIGNAL_FILE}" || fail "news signal payload must request incremental mode"
grep -q 'INTERVAL '\''${NEWS_CDC_BACKFILL_WINDOW_DAYS} days'\''' "${SIGNAL_FILE}" || fail "news signal payload must bound the recent window"
grep -q '"id": "${CDC_SIGNAL_ID}"' "${SIGNAL_FILE}" || fail "news signal payload must accept a generated signal id"
grep -q 'CDC_SIGNAL_ID' "${SIGNAL_SCRIPT}" || fail "news signal emitter must generate unique signal ids"

for topic in \
  'imperium.news.public.table_news' \
  'imperium.news.public.debezium_signal' \
  'imperium.news.schema-history' \
  'imperium.news.signals' \
  '__debezium-heartbeat.imperium.news'; do
  grep -q "${topic}" "${TOPIC_SCRIPT}" || fail "news topic bootstrap missing ${topic}"
done

grep -q '^NEWS_CDC_CONNECTOR_NAME=imperium-news-cdc$' "${ROOT_DIR}/.env.example" || fail "missing NEWS_CDC_CONNECTOR_NAME in .env.example"
grep -q '^NEWS_CDC_BACKFILL_WINDOW_DAYS=5$' "${ROOT_DIR}/.env.example" || fail "missing NEWS_CDC_BACKFILL_WINDOW_DAYS in .env.example"

# ── Result ─────────────────────────────────────────────────────────────────────
echo
if [[ "${FAIL}" -eq 0 ]]; then
  echo "All CDC asset validations passed."
else
  echo "CDC asset validation FAILED. See errors above." >&2
  exit 1
fi
