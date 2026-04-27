#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "${ROOT_DIR}/scripts/cdc-lib.sh"

connectors=(
  "${REFERENCE_CDC_CONNECTOR_NAME}"
  "${METADATA_CDC_CONNECTOR_NAME}"
  "${NEWS_CDC_CONNECTOR_NAME}"
)

for connector in "${connectors[@]}"; do
  if connector_exists "${connector}"; then
    stop_connector "${connector}" >/dev/null 2>&1 || true
    wait_for_connector_stopped "${connector}" >/dev/null 2>&1 || true
    reset_connector_offsets "${connector}" >/dev/null 2>&1 || true
    connect_api -X DELETE "${CONNECT_URL}/connectors/${connector}" >/dev/null
  fi
done

for connector in "${connectors[@]}"; do
  wait_for_connector_absent "${connector}"
done

compose --profile backbone stop kafka-connect >/dev/null 2>&1 || true
docker rm -f imperium-kafka-connect >/dev/null 2>&1 || true

for internal_topic in \
  "${CONNECT_CONFIG_STORAGE_TOPIC}" \
  "${CONNECT_OFFSET_STORAGE_TOPIC}" \
  "${CONNECT_STATUS_STORAGE_TOPIC}"
do
  kafka_exec kafka-topics --bootstrap-server "${KAFKA_BOOTSTRAP}" --delete --if-exists --topic "${internal_topic}" >/dev/null 2>&1 || true
done

for internal_topic in \
  "${CONNECT_CONFIG_STORAGE_TOPIC}" \
  "${CONNECT_OFFSET_STORAGE_TOPIC}" \
  "${CONNECT_STATUS_STORAGE_TOPIC}"
do
  wait_for_topic_absent "${internal_topic}"
done

mapfile -t topics < <(
  kafka_exec kafka-topics --bootstrap-server "${KAFKA_BOOTSTRAP}" --list \
    | grep -E '^(imperium\.(reference|metadata|news)\.|__debezium-heartbeat\.imperium\.(metadata|news)$)' \
    || true
)

for topic in "${topics[@]}"; do
  [[ -z "${topic}" ]] && continue
  kafka_exec kafka-topics --bootstrap-server "${KAFKA_BOOTSTRAP}" --delete --if-exists --topic "${topic}" >/dev/null 2>&1 || true
done

for topic in "${topics[@]}"; do
  [[ -z "${topic}" ]] && continue
  wait_for_topic_absent "${topic}"
done

for slot_name in "${REFERENCE_CDC_SLOT_NAME}" "${METADATA_CDC_SLOT_NAME}" "${NEWS_CDC_SLOT_NAME}"; do
  drop_slot_if_exists "${slot_name}"
done

for connector in "${connectors[@]}"; do
  if connector_exists "${connector}"; then
    printf 'Connector %s still exists after clean.\n' "${connector}" >&2
    exit 1
  fi
done

mapfile -t remaining_topics < <(
  kafka_exec kafka-topics --bootstrap-server "${KAFKA_BOOTSTRAP}" --list \
    | grep -E '^(imperium\.(reference|metadata|news)\.|__debezium-heartbeat\.imperium\.(metadata|news)$)' \
    || true
)
if [[ "${#remaining_topics[@]}" -gt 0 ]]; then
  printf 'CDC topics still remain after clean:\n%s\n' "${remaining_topics[*]}" >&2
  exit 1
fi

for slot_name in "${REFERENCE_CDC_SLOT_NAME}" "${METADATA_CDC_SLOT_NAME}" "${NEWS_CDC_SLOT_NAME}"; do
  if slot_exists "${slot_name}"; then
    printf 'Replication slot %s still exists after clean.\n' "${slot_name}" >&2
    exit 1
  fi
done

rm -f "${CDC_LAST_RUN_FILE}"

echo "CDC connectors, topics, signals, heartbeat topics, schema-history topics, and replication slots were cleaned."
