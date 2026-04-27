#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE_PATH="${ENV_FILE:-.env}"
COMPOSE_BIN="${COMPOSE:-docker-compose}"

# shellcheck source=load-env.sh
source "${ROOT_DIR}/scripts/load-env.sh"
load_env_file "${ENV_FILE_PATH}"
load_env_file "${ROOT_DIR}/${ENV_FILE_PATH}"

POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-imperium-news-source-db}"
POSTGRES_DB="${POSTGRES_DB:-${SOURCE_PG_DATABASE:-imperium-news-source}}"
POSTGRES_USER="${POSTGRES_USER:-${SOURCE_PG_USER:-postgres}}"

KAFKA_CONTAINER="${KAFKA_CONTAINER:-imperium-kafka-1}"
KAFKA_BOOTSTRAP="${KAFKA_BOOTSTRAP:-${KAFKA_BOOTSTRAP_SERVERS:-kafka:29092}}"
CONNECT_URL="${CONNECT_URL:-http://127.0.0.1:${CONNECT_EXTERNAL_PORT:-48083}}"
CONNECT_CONFIG_STORAGE_TOPIC="${CONNECT_CONFIG_STORAGE_TOPIC:-imperium.connect.configs}"
CONNECT_OFFSET_STORAGE_TOPIC="${CONNECT_OFFSET_STORAGE_TOPIC:-imperium.connect.offsets}"
CONNECT_STATUS_STORAGE_TOPIC="${CONNECT_STATUS_STORAGE_TOPIC:-imperium.connect.statuses}"

REFERENCE_CDC_CONNECTOR_NAME="${REFERENCE_CDC_CONNECTOR_NAME:-imperium-reference-cdc}"
METADATA_CDC_CONNECTOR_NAME="${METADATA_CDC_CONNECTOR_NAME:-imperium-metadata-cdc}"
NEWS_CDC_CONNECTOR_NAME="${NEWS_CDC_CONNECTOR_NAME:-imperium-news-cdc}"

REFERENCE_CDC_SLOT_NAME="${REFERENCE_CDC_SLOT_NAME:-imperium_reference_slot}"
METADATA_CDC_SLOT_NAME="${METADATA_CDC_SLOT_NAME:-imperium_metadata_slot}"
NEWS_CDC_SLOT_NAME="${NEWS_CDC_SLOT_NAME:-imperium_news_slot}"

METADATA_CDC_SIGNAL_TOPIC="${METADATA_CDC_SIGNAL_TOPIC:-imperium.metadata.signals}"
NEWS_CDC_SIGNAL_TOPIC="${NEWS_CDC_SIGNAL_TOPIC:-imperium.news.signals}"
CDC_STATE_DIR="${CDC_STATE_DIR:-${ROOT_DIR}/.state/cdc}"
CDC_LAST_RUN_FILE="${CDC_LAST_RUN_FILE:-${CDC_STATE_DIR}/last-run.env}"
CDC_MAX_SLOT_LAG_BYTES="${CDC_MAX_SLOT_LAG_BYTES:-104857600}"

compose() {
  "${COMPOSE_BIN}" --env-file "${ENV_FILE_PATH}" "$@"
}

pg_exec() {
  docker exec -i "${POSTGRES_CONTAINER}" psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" "$@"
}

kafka_exec() {
  docker exec -i "${KAFKA_CONTAINER}" "$@"
}

connect_api() {
  curl -fsS "$@"
}

ensure_state_dir() {
  mkdir -p "${CDC_STATE_DIR}"
}

topic_end_offset() {
  local topic="$1"
  local output=""
  output="$(kafka_exec bash -lc "kafka-run-class org.apache.kafka.tools.GetOffsetShell --bootstrap-server '${KAFKA_BOOTSTRAP}' --topic '${topic}' --time -1 2>/dev/null" || true)"
  awk -F: 'NF >= 3 {sum += $3} END {print sum+0}' <<< "${output}"
}

topic_exists() {
  local topic="$1"
  kafka_exec kafka-topics --bootstrap-server "${KAFKA_BOOTSTRAP}" --list | grep -Fx -- "${topic}" >/dev/null
}

connector_exists() {
  local connector="$1"
  curl -s -o /dev/null -w '%{http_code}' "${CONNECT_URL}/connectors/${connector}" | grep -qx '200'
}

connector_state() {
  local connector="$1"
  connect_api "${CONNECT_URL}/connectors/${connector}/status" \
    | python3 -c 'import json,sys; print(json.load(sys.stdin)["connector"]["state"])'
}

stop_connector() {
  local connector="$1"
  curl -fsS -X PUT "${CONNECT_URL}/connectors/${connector}/stop" >/dev/null
}

wait_for_connector_stopped() {
  local connector="$1"
  local tries="${2:-30}"
  local i state
  for ((i=0; i<tries; i++)); do
    if connector_exists "${connector}"; then
      state="$(connector_state "${connector}" || true)"
      if [[ "${state}" == "STOPPED" ]]; then
        return 0
      fi
    fi
    sleep 1
  done
  printf 'Connector %s failed to reach STOPPED.\n' "${connector}" >&2
  return 1
}

reset_connector_offsets() {
  local connector="$1"
  curl -fsS -X DELETE "${CONNECT_URL}/connectors/${connector}/offsets" >/dev/null
}

wait_for_connector_absent() {
  local connector="$1"
  local tries="${2:-30}"
  local i
  for ((i=0; i<tries; i++)); do
    if ! connector_exists "${connector}"; then
      return 0
    fi
    sleep 1
  done
  printf 'Connector %s is still registered.\n' "${connector}" >&2
  return 1
}

wait_for_topic_absent() {
  local topic="$1"
  local tries="${2:-60}"
  local i
  for ((i=0; i<tries; i++)); do
    if ! topic_exists "${topic}"; then
      return 0
    fi
    sleep 1
  done
  printf 'Topic %s still exists after deletion wait.\n' "${topic}" >&2
  return 1
}

wait_for_connector_running() {
  local connector="$1"
  local tries="${2:-60}"
  local i state
  for ((i=0; i<tries; i++)); do
    if connector_exists "${connector}"; then
      state="$(connector_state "${connector}" || true)"
      if [[ "${state}" == "RUNNING" ]]; then
        return 0
      fi
    fi
    sleep 2
  done
  printf 'Connector %s failed to reach RUNNING.\n' "${connector}" >&2
  return 1
}

wait_for_connect_api() {
  local tries="${1:-60}"
  local i
  for ((i=0; i<tries; i++)); do
    if curl -fsS "${CONNECT_URL}/connectors" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  printf 'Kafka Connect API did not become ready at %s.\n' "${CONNECT_URL}" >&2
  return 1
}

wait_for_topic_offset_at_least() {
  local topic="$1"
  local minimum="$2"
  local tries="${3:-20}"
  local i current
  for ((i=0; i<tries; i++)); do
    current="$(topic_end_offset "${topic}")"
    if (( current >= minimum )); then
      printf '%s' "${current}"
      return 0
    fi
    sleep 1
  done
  printf '%s' "${current:-0}"
  return 1
}

signal_topic_is_empty() {
  local topic="$1"
  [[ "$(topic_end_offset "${topic}")" -eq 0 ]]
}

table_count() {
  local table_name="$1"
  pg_exec -t -A -c "SELECT COUNT(*) FROM ${table_name};" | tr -d '[:space:]'
}

slot_state_tsv() {
  local slot_name="$1"
  pg_exec -F $'\t' -A -t -c "
SELECT slot_name,
       active,
       COALESCE(active_pid::text, ''),
       COALESCE(restart_lsn::text, ''),
       COALESCE(confirmed_flush_lsn::text, ''),
       COALESCE(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)::bigint, 0)::text
FROM pg_replication_slots
WHERE slot_name = '${slot_name}';
"
}

slot_exists() {
  local slot_name="$1"
  pg_exec -t -A -c "SELECT 1 FROM pg_replication_slots WHERE slot_name='${slot_name}'" | grep -qx '1'
}

drop_slot_if_exists() {
  local slot_name="$1"
  pg_exec <<SQL
DO \$\$
DECLARE
  v_pid integer;
BEGIN
  SELECT active_pid INTO v_pid
  FROM pg_replication_slots
  WHERE slot_name = '${slot_name}';

  IF v_pid IS NOT NULL THEN
    PERFORM pg_terminate_backend(v_pid);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_replication_slots WHERE slot_name = '${slot_name}') THEN
    PERFORM pg_drop_replication_slot('${slot_name}');
  END IF;
END
\$\$;
SQL
}

save_run_state() {
  ensure_state_dir
  cat > "${CDC_LAST_RUN_FILE}"
}
