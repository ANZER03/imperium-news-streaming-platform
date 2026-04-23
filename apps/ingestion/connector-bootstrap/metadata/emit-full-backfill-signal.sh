#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODE="${1:---dry-run}"
TOPIC_PREFIX="${METADATA_CDC_TOPIC_PREFIX:-imperium.metadata}"
SIGNAL_TOPIC="${METADATA_CDC_SIGNAL_TOPIC:-imperium.metadata.signals}"
BOOTSTRAP_SERVERS="${KAFKA_BOOTSTRAP_SERVERS:-kafka:29092,kafka-broker-2:29092}"

payload="$(python3 - "$SCRIPT_DIR/full-backfill-signal.json" <<'PY'
from pathlib import Path
from string import Template
import json
import os
import sys
import uuid

template = Path(sys.argv[1]).read_text()
os.environ.setdefault('CDC_SIGNAL_ID', f"metadata-backfill-{uuid.uuid4()}")
substituted = Template(template).substitute(os.environ)
parsed = json.loads(substituted)
print(json.dumps(parsed, separators=(',', ':')))
PY
)"

if [[ "$MODE" == "--dry-run" ]]; then
  printf '%s\n' "$payload"
  exit 0
fi

if command -v kafka-console-producer >/dev/null 2>&1; then
  printf '%s#%s\n' "$TOPIC_PREFIX" "$payload" | kafka-console-producer \
    --broker-list "$BOOTSTRAP_SERVERS" \
    --topic "$SIGNAL_TOPIC" \
    --property "parse.key=true" \
    --property "key.separator=#"
else
  printf '%s#%s\n' "$TOPIC_PREFIX" "$payload" | docker exec -i imperium-kafka-1 kafka-console-producer \
    --broker-list kafka:29092 \
    --topic "$SIGNAL_TOPIC" \
    --property "parse.key=true" \
    --property "key.separator=#"
fi
