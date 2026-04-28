#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "${ROOT_DIR}/scripts/cdc-lib.sh"

if [[ -f "${CDC_LAST_RUN_FILE}" ]]; then
  # shellcheck disable=SC1090
  source "${CDC_LAST_RUN_FILE}"
fi

assert_connector_running() {
  local connector="$1"
  local state
  if ! connector_exists "${connector}"; then
    printf 'Connector %s is not registered.\n' "${connector}" >&2
    exit 1
  fi
  state="$(connector_state "${connector}")"
  if [[ "${state}" != "RUNNING" ]]; then
    printf 'Connector %s state is %s, expected RUNNING.\n' "${connector}" "${state}" >&2
    exit 1
  fi
  printf '%s=RUNNING\n' "${connector}"
}

assert_count_parity() {
  local table_name="$1"
  local topic_name="$2"
  local db_count topic_count
  db_count="$(table_count "${table_name}")"
  topic_count="$(topic_end_offset "${topic_name}")"
  printf '%s rows=%s topic=%s\n' "${table_name}" "${db_count}" "${topic_count}"
  if [[ "${db_count}" != "${topic_count}" ]]; then
    printf 'Parity failed for %s vs %s.\n' "${table_name}" "${topic_name}" >&2
    exit 1
  fi
}

# Snapshot-aware check: only fail if topic has MORE records than DB (duplication).
# Under-count is expected while incremental snapshot is still in progress.
assert_count_no_duplication() {
  local table_name="$1"
  local topic_name="$2"
  local db_count topic_count
  db_count="$(table_count "${table_name}")"
  topic_count="$(topic_end_offset "${topic_name}")"
  printf '%s rows=%s topic=%s\n' "${table_name}" "${db_count}" "${topic_count}"
  if [[ "${topic_count}" -gt "${db_count}" ]]; then
    printf 'Duplication detected: %s has topic=%s > db=%s.\n' "${table_name}" "${topic_count}" "${db_count}" >&2
    exit 1
  fi
}

assert_signal_topic_matches_run() {
  local topic_name="$1"
  local expected_id="$2"
  local expected_before="$3"
  local expected_after="$4"
  local actual_after payload

  actual_after="$(topic_end_offset "${topic_name}")"
  printf '%s offsets before=%s after=%s current=%s\n' "${topic_name}" "${expected_before}" "${expected_after}" "${actual_after}"
  if [[ "${actual_after}" != "${expected_after}" ]]; then
    printf 'Signal topic %s current offset %s does not match recorded post-emit offset %s.\n' "${topic_name}" "${actual_after}" "${expected_after}" >&2
    exit 1
  fi

  payload="$(kafka_exec bash -lc "kafka-console-consumer --bootstrap-server '${KAFKA_BOOTSTRAP}' --topic '${topic_name}' --from-beginning --max-messages 10 --timeout-ms 8000 2>/dev/null" || true)"
  if ! grep -F "\"id\":\"${expected_id}\"" <<< "${payload}" >/dev/null; then
    printf 'Signal topic %s does not contain expected signal id %s.\n' "${topic_name}" "${expected_id}" >&2
    exit 1
  fi
}

assert_slot_healthy() {
  local slot_name="$1"
  local state
  local active
  local lag_bytes

  state="$(slot_state_tsv "${slot_name}")"
  if [[ -z "${state}" ]]; then
    printf 'Replication slot %s does not exist.\n' "${slot_name}" >&2
    exit 1
  fi

  IFS=$'\t' read -r _slot active _pid _restart_lsn _confirmed_flush_lsn lag_bytes <<< "${state}"
  printf '%s active=%s lag_bytes=%s\n' "${slot_name}" "${active}" "${lag_bytes}"

  if [[ "${active}" != "t" ]]; then
    printf 'Replication slot %s is not active.\n' "${slot_name}" >&2
    exit 1
  fi

  if (( lag_bytes > CDC_MAX_SLOT_LAG_BYTES )); then
    printf 'Replication slot %s lag %s exceeds threshold %s.\n' "${slot_name}" "${lag_bytes}" "${CDC_MAX_SLOT_LAG_BYTES}" >&2
    exit 1
  fi
}

echo "Connector states:"
assert_connector_running "${REFERENCE_CDC_CONNECTOR_NAME}"
assert_connector_running "${METADATA_CDC_CONNECTOR_NAME}"
assert_connector_running "${NEWS_CDC_CONNECTOR_NAME}"

echo
echo "Source-vs-topic parity:"
assert_count_parity "public.table_pays" "imperium.reference.public.table_pays"
assert_count_parity "public.table_langue" "imperium.reference.public.table_langue"
assert_count_parity "public.table_rubrique" "imperium.reference.public.table_rubrique"
assert_count_parity "public.table_sedition" "imperium.reference.public.table_sedition"
assert_count_no_duplication "public.table_authority" "imperium.metadata.public.table_authority"
assert_count_no_duplication "public.table_links" "imperium.metadata.public.table_links"
assert_count_no_duplication "public.table_news" "imperium.news.public.table_news"

echo
echo "Signal hygiene:"
if [[ -n "${METADATA_SIGNAL_ID:-}" ]]; then
  assert_signal_topic_matches_run \
    "${METADATA_SIGNAL_TOPIC:-${METADATA_CDC_SIGNAL_TOPIC}}" \
    "${METADATA_SIGNAL_ID}" \
    "${METADATA_SIGNAL_OFFSET_BEFORE:-0}" \
    "${METADATA_SIGNAL_OFFSET_AFTER:-0}"
else
  printf '%s current=%s\n' "${METADATA_CDC_SIGNAL_TOPIC}" "$(topic_end_offset "${METADATA_CDC_SIGNAL_TOPIC}")"
fi

if [[ -n "${NEWS_SIGNAL_ID:-}" ]]; then
  assert_signal_topic_matches_run \
    "${NEWS_SIGNAL_TOPIC:-${NEWS_CDC_SIGNAL_TOPIC}}" \
    "${NEWS_SIGNAL_ID}" \
    "${NEWS_SIGNAL_OFFSET_BEFORE:-0}" \
    "${NEWS_SIGNAL_OFFSET_AFTER:-0}"
else
  printf '%s current=%s\n' "${NEWS_CDC_SIGNAL_TOPIC}" "$(topic_end_offset "${NEWS_CDC_SIGNAL_TOPIC}")"
fi

echo
echo "Replication slots:"
assert_slot_healthy "${METADATA_CDC_SLOT_NAME}"
assert_slot_healthy "${NEWS_CDC_SLOT_NAME}"

echo
echo "CDC verification passed."
