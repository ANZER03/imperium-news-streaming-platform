#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WINDOW_DAYS="${NEWS_CDC_BACKFILL_WINDOW_DAYS:-5}"
MODE="${1:---dry-run}"
TOPIC_PREFIX="${NEWS_CDC_TOPIC_PREFIX:-imperium.news}"
SIGNAL_TOPIC="${NEWS_CDC_SIGNAL_TOPIC:-imperium.news.signals}"
BOOTSTRAP_SERVERS="${KAFKA_BOOTSTRAP_SERVERS:-kafka:29092,kafka-broker-2:29092}"

payload="$(python3 - "$SCRIPT_DIR/recent-backfill-signal.json" "$WINDOW_DAYS" <<'PY'
from pathlib import Path
from string import Template
import os
import sys
import json
import uuid

template = Path(sys.argv[1]).read_text()
os.environ.setdefault('NEWS_CDC_BACKFILL_WINDOW_DAYS', sys.argv[2])
os.environ.setdefault('CDC_SIGNAL_ID', f"news-backfill-{uuid.uuid4()}")
substituted = Template(template).substitute(os.environ)

# Flatten JSON to a single line for kafka-console-producer
parsed = json.loads(substituted)
print(json.dumps(parsed, separators=(',', ':')))
PY
)"

if [[ "$MODE" == "--dry-run" ]]; then
  printf '%s\n' "$payload"
  exit 0
fi

# Send to Kafka using the connector's topic.prefix as the message key
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
