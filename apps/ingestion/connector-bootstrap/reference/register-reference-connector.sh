#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_FILE="$SCRIPT_DIR/reference-connector.json"
CONNECT_URL="${CONNECT_URL:-http://127.0.0.1:48083}"
MODE="${1:---dry-run}"

payload="$(python3 - "$TEMPLATE_FILE" <<'PY'
from pathlib import Path
from string import Template
import os
import sys

template = Path(sys.argv[1]).read_text()
print(Template(template).substitute(os.environ))
PY
)"

if [[ "$MODE" == "--dry-run" ]]; then
  printf '%s\n' "$payload"
  exit 0
fi

printf '%s' "$payload" | curl -sf \
  -X POST \
  -H 'Content-Type: application/json' \
  --data-binary @- \
  "$CONNECT_URL/connectors"
