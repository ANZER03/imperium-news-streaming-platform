#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
TEMPLATE_FILE="$SCRIPT_DIR/metadata-connector.json"
CONNECT_URL="${CONNECT_URL:-http://127.0.0.1:48083}"
CONNECTOR_NAME="${METADATA_CDC_CONNECTOR_NAME:-imperium-metadata-cdc}"
SIGNAL_TOPIC="${METADATA_CDC_SIGNAL_TOPIC:-imperium.metadata.signals}"
MODE="${1:---dry-run}"

# shellcheck source=../common/connect-signal-guard.sh
source "$ROOT_DIR/apps/ingestion/connector-bootstrap/common/connect-signal-guard.sh"

payload="$(python3 - "$TEMPLATE_FILE" <<'PY'
from pathlib import Path
from string import Template
import os
import sys

template = Path(sys.argv[1]).read_text()
print(Template(template).substitute(os.environ))
PY
)"

config_payload="$(PAYLOAD="$payload" python3 <<'PY'
import json
import os

print(json.dumps(json.loads(os.environ["PAYLOAD"])["config"]))
PY
)"

if [[ "$MODE" == "--dry-run" ]]; then
  printf '%s\n' "$payload"
  exit 0
fi

require_empty_signal_topic "$SIGNAL_TOPIC"

if curl -sf -o /dev/null "$CONNECT_URL/connectors/$CONNECTOR_NAME"; then
  printf '%s' "$config_payload" | curl -sf \
    -X PUT \
    -H 'Content-Type: application/json' \
    --data-binary @- \
    "$CONNECT_URL/connectors/$CONNECTOR_NAME/config"
else
  printf '%s' "$payload" | curl -sf \
    -X POST \
    -H 'Content-Type: application/json' \
    --data-binary @- \
    "$CONNECT_URL/connectors"
fi
