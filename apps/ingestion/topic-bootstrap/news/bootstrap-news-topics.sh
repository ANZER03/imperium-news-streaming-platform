#!/usr/bin/env bash

set -euo pipefail

KAFKA_BOOTSTRAP_SERVERS="${KAFKA_BOOTSTRAP_SERVERS:-kafka:29092,kafka-broker-2:29092}"
KAFKA_REPLICATION_FACTOR="${KAFKA_REPLICATION_FACTOR:-2}"
NEWS_CDC_TOPIC_PARTITIONS="${NEWS_CDC_TOPIC_PARTITIONS:-1}"
NEWS_CDC_SCHEMA_HISTORY_TOPIC="${NEWS_CDC_SCHEMA_HISTORY_TOPIC:-imperium.news.schema-history}"
NEWS_CDC_SIGNAL_TOPIC="${NEWS_CDC_SIGNAL_TOPIC:-imperium.news.signals}"
NEWS_CDC_HEARTBEAT_TOPIC="${NEWS_CDC_HEARTBEAT_TOPIC:-__debezium-heartbeat.imperium.news}"

kafka_topics_cmd() {
  if command -v kafka-topics >/dev/null 2>&1; then
    kafka-topics "$@"
  else
    docker exec -i imperium-kafka-1 kafka-topics "$@"
  fi
}

kafka_topics_cmd \
  --bootstrap-server "$KAFKA_BOOTSTRAP_SERVERS" \
  --create \
  --if-not-exists \
  --topic "imperium.news.public.table_news" \
  --partitions "$NEWS_CDC_TOPIC_PARTITIONS" \
  --replication-factor "$KAFKA_REPLICATION_FACTOR"

kafka_topics_cmd \
  --bootstrap-server "$KAFKA_BOOTSTRAP_SERVERS" \
  --create \
  --if-not-exists \
  --topic "imperium.news.public.debezium_signal" \
  --partitions 1 \
  --replication-factor "$KAFKA_REPLICATION_FACTOR" \
  --config cleanup.policy=compact

for topic in "$NEWS_CDC_SCHEMA_HISTORY_TOPIC" "$NEWS_CDC_SIGNAL_TOPIC" "$NEWS_CDC_HEARTBEAT_TOPIC"; do
  kafka_topics_cmd \
    --bootstrap-server "$KAFKA_BOOTSTRAP_SERVERS" \
    --create \
    --if-not-exists \
    --topic "$topic" \
    --partitions 1 \
    --replication-factor "$KAFKA_REPLICATION_FACTOR" \
    --config cleanup.policy=compact
done
