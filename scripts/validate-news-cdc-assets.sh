#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONNECTOR_FILE="$ROOT_DIR/apps/ingestion/connector-bootstrap/news/news-connector.json"
REGISTER_SCRIPT="$ROOT_DIR/apps/ingestion/connector-bootstrap/news/register-news-connector.sh"
SIGNAL_SCRIPT="$ROOT_DIR/apps/ingestion/connector-bootstrap/news/emit-recent-backfill-signal.sh"
SIGNAL_FILE="$ROOT_DIR/apps/ingestion/connector-bootstrap/news/recent-backfill-signal.json"
TOPIC_SCRIPT="$ROOT_DIR/apps/ingestion/topic-bootstrap/news/bootstrap-news-topics.sh"
RESET_SCRIPT="$ROOT_DIR/apps/ingestion/topic-bootstrap/news/reset-news-signal-topic.sh"
GUARD_SCRIPT="$ROOT_DIR/apps/ingestion/connector-bootstrap/common/connect-signal-guard.sh"

fail() {
  printf '%s\n' "$1" >&2
  exit 1
}

for file in "$CONNECTOR_FILE" "$REGISTER_SCRIPT" "$SIGNAL_SCRIPT" "$SIGNAL_FILE" "$TOPIC_SCRIPT" "$RESET_SCRIPT" "$GUARD_SCRIPT"; do
  [[ -f "$file" ]] || fail "missing news CDC asset: $file"
done

grep -q '"snapshot.mode": "never"' "$CONNECTOR_FILE" || fail "news connector must avoid historical snapshotting"
grep -q '"signal.enabled.channels": "source,kafka"' "$CONNECTOR_FILE" || fail "news connector must use Kafka signals"
grep -q '"signal.kafka.topic": "${NEWS_CDC_SIGNAL_TOPIC}"' "$CONNECTOR_FILE" || fail "news connector must define a signal topic"
grep -q '"table.include.list": "${NEWS_CDC_TABLE}"' "$CONNECTOR_FILE" || fail "news connector must target table_news only"
grep -q 'require_empty_signal_topic' "$REGISTER_SCRIPT" || fail "news connector registration must guard against retained signal replay"

grep -q '"type": "execute-snapshot"' "$SIGNAL_FILE" || fail "news signal payload must request a snapshot"
grep -q '"type": "INCREMENTAL"' "$SIGNAL_FILE" || fail "news signal payload must request incremental mode"
grep -q 'INTERVAL '\''${NEWS_CDC_BACKFILL_WINDOW_DAYS} days'\''' "$SIGNAL_FILE" || fail "news signal payload must bound the recent window"
grep -q '"id": "${CDC_SIGNAL_ID}"' "$SIGNAL_FILE" || fail "news signal payload must accept a generated signal id"
grep -q 'CDC_SIGNAL_ID' "$SIGNAL_SCRIPT" || fail "news signal emitter must generate unique signal ids"

for topic in \
  'imperium.news.public.table_news' \
  'imperium.news.schema-history' \
  'imperium.news.signals'; do
  grep -q "$topic" "$TOPIC_SCRIPT" || fail "news topic bootstrap missing $topic"
done

grep -q '^NEWS_CDC_CONNECTOR_NAME=imperium-news-cdc$' "$ROOT_DIR/.env.example" || fail "missing news CDC env vars"
grep -q '^NEWS_CDC_BACKFILL_WINDOW_DAYS=5$' "$ROOT_DIR/.env.example" || fail "missing news backfill window env var"
