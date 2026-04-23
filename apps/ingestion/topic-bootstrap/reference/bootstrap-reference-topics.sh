#!/usr/bin/env bash

set -euo pipefail

KAFKA_BOOTSTRAP_SERVERS="${KAFKA_BOOTSTRAP_SERVERS:-kafka:29092,kafka-broker-2:29092}"
KAFKA_REPLICATION_FACTOR="${KAFKA_REPLICATION_FACTOR:-2}"
REFERENCE_CDC_TOPIC_PARTITIONS="${REFERENCE_CDC_TOPIC_PARTITIONS:-1}"
REFERENCE_CDC_SCHEMA_HISTORY_TOPIC="${REFERENCE_CDC_SCHEMA_HISTORY_TOPIC:-imperium.reference.schema-history}"

topics=(
  "imperium.reference.public.table_pays"
  "imperium.reference.public.table_langue"
  "imperium.reference.public.table_rubrique"
  "imperium.reference.public.table_sedition"
)

for topic in "${topics[@]}"; do
  kafka-topics \
    --bootstrap-server "$KAFKA_BOOTSTRAP_SERVERS" \
    --create \
    --if-not-exists \
    --topic "$topic" \
    --partitions "$REFERENCE_CDC_TOPIC_PARTITIONS" \
    --replication-factor "$KAFKA_REPLICATION_FACTOR"
done

kafka-topics \
  --bootstrap-server "$KAFKA_BOOTSTRAP_SERVERS" \
  --create \
  --if-not-exists \
  --topic "$REFERENCE_CDC_SCHEMA_HISTORY_TOPIC" \
  --partitions 1 \
  --replication-factor "$KAFKA_REPLICATION_FACTOR" \
  --config cleanup.policy=compact
