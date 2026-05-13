#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "${ROOT_DIR}/scripts/lib/cdc.sh"

if [[ -f "${CDC_LAST_RUN_FILE}" ]]; then
  # shellcheck disable=SC1090
  source "${CDC_LAST_RUN_FILE}"
fi

assert_connector_running() {
  local connector="$1"
  local state
  if ! connector_exists "${connector}"; then
    printf 'FAIL: Connector %s is not registered.\n' "${connector}" >&2
    return 1
  fi
  state="$(connector_state "${connector}")"
  if [[ "${state}" != "RUNNING" ]]; then
    printf 'FAIL: Connector %s state is %s, expected RUNNING.\n' "${connector}" "${state}" >&2
    return 1
  fi
  printf 'OK: %s=RUNNING\n' "${connector}"
}

assert_count_parity() {
  local table_name="$1"
  local topic_name="$2"
  local db_count topic_count
  db_count="$(table_count "${table_name}")"
  topic_count="$(topic_end_offset "${topic_name}")"
  printf '%s rows=%s topic=%s ' "${table_name}" "${db_count}" "${topic_count}"
  if [[ "${db_count}" != "${topic_count}" ]]; then
    printf '→ FAIL\n' >&2
    return 1
  fi
  printf '→ OK\n'
}

# Fail only on duplication (topic > db). Under-count is OK (snapshot in progress).
assert_count_no_duplication() {
  local table_name="$1"
  local topic_name="$2"
  local db_count topic_count
  db_count="$(table_count "${table_name}")"
  topic_count="$(topic_end_offset "${topic_name}")"
  printf '%s rows=%s topic=%s ' "${table_name}" "${db_count}" "${topic_count}"
  if [[ "${topic_count}" -gt "${db_count}" ]]; then
    printf '→ FAIL (duplication)\n' >&2
    return 1
  fi
  printf '→ OK\n'
}

assert_signal_topic_matches_run() {
  local topic_name="$1"
  local expected_id="$2"
  local expected_before="$3"
  local expected_after="$4"
  local actual_after payload

  actual_after="$(topic_end_offset "${topic_name}")"
  printf '%s offsets before=%s after=%s current=%s ' "${topic_name}" "${expected_before}" "${expected_after}" "${actual_after}"
  if [[ "${actual_after}" != "${expected_after}" ]]; then
    printf '→ FAIL (offset mismatch)\n' >&2
    return 1
  fi

  payload="$(kafka_exec bash -lc "kafka-console-consumer --bootstrap-server '${KAFKA_BOOTSTRAP}' --topic '${topic_name}' --from-beginning --max-messages 10 --timeout-ms 8000 2>/dev/null" || true)"
  if ! grep -F "\"id\":\"${expected_id}\"" <<< "${payload}" >/dev/null; then
    printf '→ FAIL (signal id not found)\n' >&2
    return 1
  fi
  printf '→ OK\n'
}

assert_slot_healthy() {
  local slot_name="$1"
  local state active lag_bytes

  state="$(slot_state_tsv "${slot_name}")"
  if [[ -z "${state}" ]]; then
    printf 'FAIL: Replication slot %s does not exist.\n' "${slot_name}" >&2
    return 1
  fi

  IFS=$'\t' read -r _slot active _pid _restart_lsn _confirmed_flush_lsn lag_bytes <<< "${state}"
  printf '%s active=%s lag_bytes=%s ' "${slot_name}" "${active}" "${lag_bytes}"

  if [[ "${active}" != "t" ]]; then
    printf '→ FAIL (not active)\n' >&2
    return 1
  fi
  if (( lag_bytes > CDC_MAX_SLOT_LAG_BYTES )); then
    printf '→ FAIL (lag %s > threshold %s)\n' "${lag_bytes}" "${CDC_MAX_SLOT_LAG_BYTES}" >&2
    return 1
  fi
  printf '→ OK\n'
}

FAIL=0

echo "Connector states:"
assert_connector_running "${REFERENCE_CDC_CONNECTOR_NAME}" || FAIL=1
assert_connector_running "${METADATA_CDC_CONNECTOR_NAME}" || FAIL=1
assert_connector_running "${NEWS_CDC_CONNECTOR_NAME}" || FAIL=1

echo
echo "Source-vs-topic parity:"
assert_count_parity "public.table_pays" "imperium.reference.public.table_pays" || FAIL=1
assert_count_parity "public.table_langue" "imperium.reference.public.table_langue" || FAIL=1
assert_count_parity "public.table_rubrique" "imperium.reference.public.table_rubrique" || FAIL=1
assert_count_parity "public.table_sedition" "imperium.reference.public.table_sedition" || FAIL=1
assert_count_no_duplication "public.table_authority" "imperium.metadata.public.table_authority" || FAIL=1
assert_count_no_duplication "public.table_links" "imperium.metadata.public.table_links" || FAIL=1
assert_count_no_duplication "public.table_news" "imperium.news.public.table_news" || FAIL=1

echo
echo "Signal hygiene:"
if [[ -n "${METADATA_SIGNAL_ID:-}" ]]; then
  assert_signal_topic_matches_run \
    "${METADATA_SIGNAL_TOPIC:-${METADATA_CDC_SIGNAL_TOPIC}}" \
    "${METADATA_SIGNAL_ID}" \
    "${METADATA_SIGNAL_OFFSET_BEFORE:-0}" \
    "${METADATA_SIGNAL_OFFSET_AFTER:-0}" || FAIL=1
else
  printf '%s current=%s\n' "${METADATA_CDC_SIGNAL_TOPIC}" "$(topic_end_offset "${METADATA_CDC_SIGNAL_TOPIC}")"
fi

if [[ -n "${NEWS_SIGNAL_ID:-}" ]]; then
  assert_signal_topic_matches_run \
    "${NEWS_SIGNAL_TOPIC:-${NEWS_CDC_SIGNAL_TOPIC}}" \
    "${NEWS_SIGNAL_ID}" \
    "${NEWS_SIGNAL_OFFSET_BEFORE:-0}" \
    "${NEWS_SIGNAL_OFFSET_AFTER:-0}" || FAIL=1
else
  printf '%s current=%s\n' "${NEWS_CDC_SIGNAL_TOPIC}" "$(topic_end_offset "${NEWS_CDC_SIGNAL_TOPIC}")"
fi

echo
echo "Replication slots:"
assert_slot_healthy "${METADATA_CDC_SLOT_NAME}" || FAIL=1
assert_slot_healthy "${NEWS_CDC_SLOT_NAME}" || FAIL=1

echo
if [[ "${FAIL}" -eq 0 ]]; then
  echo "CDC verification passed."
else
  echo "CDC verification FAILED. See errors above." >&2
  exit 1
fi
