#!/usr/bin/env bash

set -euo pipefail

signal_topic_has_records() {
  local signal_topic="$1"
  local output=""

  if command -v kafka-console-consumer >/dev/null 2>&1; then
    output="$(kafka-console-consumer \
      --bootstrap-server "${KAFKA_BOOTSTRAP_SERVERS:-kafka:29092,kafka-broker-2:29092}" \
      --topic "$signal_topic" \
      --from-beginning \
      --max-messages 1 \
      --timeout-ms 2000 2>/dev/null || true)"
  else
    output="$(docker exec imperium-kafka-1 bash -lc \
      "kafka-console-consumer --bootstrap-server kafka:29092 --topic '$signal_topic' --from-beginning --max-messages 1 --timeout-ms 2000" \
      2>/dev/null || true)"
  fi

  [[ -n "${output//$'\n'/}" ]]
}

require_empty_signal_topic() {
  local signal_topic="$1"

  if [[ "${ALLOW_NONEMPTY_SIGNAL_TOPIC:-0}" == "1" ]]; then
    return 0
  fi

  if signal_topic_has_records "$signal_topic"; then
    printf 'Refusing connector registration: signal topic %s still contains retained records.\n' "$signal_topic" >&2
    printf 'Reset the signal topic first or rerun with ALLOW_NONEMPTY_SIGNAL_TOPIC=1 if replay is intentional.\n' >&2
    return 1
  fi
}
