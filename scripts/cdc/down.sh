#!/usr/bin/env bash
# Pause all CDC connectors without removing topics or replication slots.
# Use clean.sh for a full teardown.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "${ROOT_DIR}/scripts/lib/cdc.sh"

for connector in \
  "${REFERENCE_CDC_CONNECTOR_NAME}" \
  "${METADATA_CDC_CONNECTOR_NAME}" \
  "${NEWS_CDC_CONNECTOR_NAME}"
do
  if connector_exists "${connector}"; then
    stop_connector "${connector}"
    wait_for_connector_stopped "${connector}"
    printf 'Stopped %s\n' "${connector}"
  else
    printf 'Connector %s not found, skipping.\n' "${connector}"
  fi
done

echo "All CDC connectors stopped. Topics and replication slots are preserved."
echo "Run scripts/cdc/up.sh to restart."
