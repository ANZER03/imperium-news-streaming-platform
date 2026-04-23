#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KAFKA_BOOTSTRAP_SERVERS="${KAFKA_BOOTSTRAP_SERVERS:-kafka:29092,kafka-broker-2:29092}"
SIGNAL_TOPIC="${METADATA_CDC_SIGNAL_TOPIC:-imperium.metadata.signals}"

kafka-topics \
  --bootstrap-server "$KAFKA_BOOTSTRAP_SERVERS" \
  --delete \
  --if-exists \
  --topic "$SIGNAL_TOPIC"

"$SCRIPT_DIR/bootstrap-metadata-topics.sh"
