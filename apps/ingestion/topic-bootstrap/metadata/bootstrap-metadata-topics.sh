#!/usr/bin/env bash

set -euo pipefail

KAFKA_BOOTSTRAP_SERVERS="${KAFKA_BOOTSTRAP_SERVERS:-kafka:29092,kafka-broker-2:29092}"
KAFKA_REPLICATION_FACTOR="${KAFKA_REPLICATION_FACTOR:-2}"
METADATA_CDC_TOPIC_PARTITIONS="${METADATA_CDC_TOPIC_PARTITIONS:-1}"
METADATA_CDC_SCHEMA_HISTORY_TOPIC="${METADATA_CDC_SCHEMA_HISTORY_TOPIC:-imperium.metadata.schema-history}"
METADATA_CDC_SIGNAL_TOPIC="${METADATA_CDC_SIGNAL_TOPIC:-imperium.metadata.signals}"
METADATA_CDC_HEARTBEAT_TOPIC="${METADATA_CDC_HEARTBEAT_TOPIC:-__debezium-heartbeat.imperium.metadata}"

topics=(
  "imperium.metadata.public.table_authority"
  "imperium.metadata.public.table_links"
  "imperium.metadata.public.debezium_signal"
)

for topic in "${topics[@]}"; do
  kafka-topics \
    --bootstrap-server "$KAFKA_BOOTSTRAP_SERVERS" \
    --create \
    --if-not-exists \
    --topic "$topic" \
    --partitions "$METADATA_CDC_TOPIC_PARTITIONS" \
    --replication-factor "$KAFKA_REPLICATION_FACTOR"
done

for topic in "$METADATA_CDC_SCHEMA_HISTORY_TOPIC" "$METADATA_CDC_SIGNAL_TOPIC" "$METADATA_CDC_HEARTBEAT_TOPIC"; do
  kafka-topics \
    --bootstrap-server "$KAFKA_BOOTSTRAP_SERVERS" \
    --create \
    --if-not-exists \
    --topic "$topic" \
    --partitions 1 \
    --replication-factor "$KAFKA_REPLICATION_FACTOR" \
    --config cleanup.policy=compact
done
