#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONNECT_URL="${CONNECT_URL:-http://127.0.0.1:48083}"
TEMPLATE_DIR="$ROOT_DIR/apps/ingestion/sink-templates/temp-postgres"

export TARGET_PG_HOST="${TARGET_PG_HOST:-imperium-sink-test-db}"
export TARGET_PG_PORT="${TARGET_PG_PORT:-5432}"
export TARGET_PG_DATABASE="${TARGET_PG_DATABASE:-imperium_sink_test}"
export TARGET_PG_USER="${TARGET_PG_USER:-sink_user}"
export TARGET_PG_PASSWORD="${TARGET_PG_PASSWORD:-sink_password}"

export TEMP_SINK_REF_PAYS_NAME="${TEMP_SINK_REF_PAYS_NAME:-imperium-temp-sink-ref-pays}"
export TEMP_SINK_REF_LANGUE_NAME="${TEMP_SINK_REF_LANGUE_NAME:-imperium-temp-sink-ref-langue}"
export TEMP_SINK_REF_RUBRIQUE_NAME="${TEMP_SINK_REF_RUBRIQUE_NAME:-imperium-temp-sink-ref-rubrique}"
export TEMP_SINK_REF_SEDITION_NAME="${TEMP_SINK_REF_SEDITION_NAME:-imperium-temp-sink-ref-sedition}"
export TEMP_SINK_METADATA_AUTHORITY_NAME="${TEMP_SINK_METADATA_AUTHORITY_NAME:-imperium-temp-sink-meta-authority}"
export TEMP_SINK_METADATA_LINKS_NAME="${TEMP_SINK_METADATA_LINKS_NAME:-imperium-temp-sink-meta-links}"
export TEMP_SINK_NEWS_NAME="${TEMP_SINK_NEWS_NAME:-imperium-temp-sink-news}"

for template in "$TEMPLATE_DIR"/*.json; do
  payload="$(python3 - "$template" <<'PY'
from pathlib import Path
from string import Template
import json
import os
import sys

content = Template(Path(sys.argv[1]).read_text()).substitute(os.environ)
parsed = json.loads(content)
print(json.dumps(parsed, separators=(',', ':')))
PY
)"

  connector_name="$(PAYLOAD="$payload" python3 <<'PY'
import json
import os

print(json.loads(os.environ["PAYLOAD"])["name"])
PY
)"

  config_payload="$(PAYLOAD="$payload" python3 <<'PY'
import json
import os

print(json.dumps(json.loads(os.environ["PAYLOAD"])["config"], separators=(',', ':')))
PY
)"

  if curl -sf -o /dev/null "$CONNECT_URL/connectors/$connector_name"; then
    printf '%s' "$config_payload" | curl -sf \
      -X PUT \
      -H 'Content-Type: application/json' \
      --data-binary @- \
      "$CONNECT_URL/connectors/$connector_name/config" >/dev/null
  else
    printf '%s' "$payload" | curl -sf \
      -X POST \
      -H 'Content-Type: application/json' \
      --data-binary @- \
      "$CONNECT_URL/connectors" >/dev/null
  fi

  printf 'Registered %s\n' "$connector_name"
done
