#!/usr/bin/env bash

set -euo pipefail

KAFKA_CONTAINER="${KAFKA_CONTAINER:-imperium-kafka-1}"
KAFKA_BROKER_2_CONTAINER="${KAFKA_BROKER_2_CONTAINER:-imperium-kafka-2}"
SCHEMA_REGISTRY_CONTAINER="${SCHEMA_REGISTRY_CONTAINER:-imperium-schema-registry}"
CONNECT_CONTAINER="${CONNECT_CONTAINER:-imperium-kafka-connect}"
SOURCE_PG_CONTAINER="${SOURCE_PG_CONTAINER:-imperium-news-source-db}"
SPARK_MASTER_CONTAINER="${SPARK_MASTER_CONTAINER:-imperium-spark-master}"
SPARK_WORKER_CONTAINER="${SPARK_WORKER_CONTAINER:-imperium-spark-worker-1}"
REDIS_CONTAINER="${REDIS_CONTAINER:-imperium-redis}"
QDRANT_CONTAINER="${QDRANT_CONTAINER:-imperium-qdrant}"

KAFKA_URL="${KAFKA_URL:-localhost:49092}"
SCHEMA_REGISTRY_URL="${SCHEMA_REGISTRY_URL:-http://127.0.0.1:48081}"
CONNECT_URL="${CONNECT_URL:-http://127.0.0.1:48083}"
SPARK_MASTER_URL="${SPARK_MASTER_URL:-http://127.0.0.1:48080}"
SPARK_WORKER_URL="${SPARK_WORKER_URL:-http://127.0.0.1:48091}"
REDIS_HOST="${REDIS_HOST:-127.0.0.1}"
REDIS_PORT="${REDIS_PORT:-46379}"
QDRANT_URL="${QDRANT_URL:-http://127.0.0.1:46333}"

PASS=0
FAIL=0

check() {
    local label="$1"
    local result="$2"
    local detail="${3:-}"

    if [[ "$result" == "ok" ]]; then
        printf "  %-40s [PASS]\n" "$label"
        (( PASS++ )) || true
    else
        printf "  %-40s [FAIL]  %s\n" "$label" "$detail"
        (( FAIL++ )) || true
    fi
}

docker_healthy() {
    local container="$1"
    local state
    state=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container" 2>/dev/null || echo "missing")
    [[ "$state" == "healthy" || "$state" == "running" ]] && echo "ok" || echo "$state"
}

http_ok() {
    local url="$1"
    local code
    local attempt
    for attempt in 1 2 3 4 5; do
        code=$(curl -sf -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
        if [[ "$code" == "200" ]]; then
            echo "ok"
            return 0
        fi
        sleep 2
    done
    echo "http_$code"
}

json_contains() {
    local url="$1"
    local pattern="$2"
    local body
    body=$(curl -sf "$url" 2>/dev/null || echo "")
    [[ "$body" == *"$pattern"* ]] && echo "ok" || echo "missing"
}

redis_ping() {
    if docker exec "$REDIS_CONTAINER" redis-cli -h redis -p 6379 ping 2>/dev/null | grep -q PONG; then
        echo "ok"
    else
        echo "failed"
    fi
}

spark_worker_registered() {
    local body
    body=$(curl -sf "$SPARK_MASTER_URL/json/" 2>/dev/null || echo "")
    [[ "$body" == *"spark-worker"* || "$body" == *"workers"* ]] && echo "ok" || echo "missing"
}

connect_plugins_ready() {
    local body
    body=$(curl -sf "$CONNECT_URL/connector-plugins" 2>/dev/null || echo "")
    if [[ "$body" == *"PostgresConnector"* && "$body" == *"SqlServerConnector"* ]]; then
        echo "ok"
    else
        echo "missing"
    fi
}

source_postgres_ready() {
    local body
    body=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$SOURCE_PG_CONTAINER" 2>/dev/null || echo "missing")
    [[ "$body" == "healthy" || "$body" == "running" ]] && echo "ok" || echo "$body"
}

avro_converter_ready() {
    if docker exec "$CONNECT_CONTAINER" sh -lc 'find /kafka/connect -iname "*kafka-avro-serializer*.jar" | grep -q .' 2>/dev/null; then
        echo "ok"
    else
        echo "missing"
    fi
}

reference_cdc_assets_ready() {
    if bash scripts/validate-reference-cdc-assets.sh >/dev/null 2>&1; then
        echo "ok"
    else
        echo "missing"
    fi
}

metadata_cdc_assets_ready() {
    if bash scripts/validate-metadata-cdc-assets.sh >/dev/null 2>&1; then
        echo "ok"
    else
        echo "missing"
    fi
}

news_cdc_assets_ready() {
    if bash scripts/validate-news-cdc-assets.sh >/dev/null 2>&1; then
        echo "ok"
    else
        echo "missing"
    fi
}

kafka_metadata_ready() {
    if docker exec "$KAFKA_CONTAINER" kafka-broker-api-versions --bootstrap-server kafka:29092 >/dev/null 2>&1; then
        echo "ok"
    else
        echo "failed"
    fi
}

schema_registry_ready() {
    if docker exec "$SCHEMA_REGISTRY_CONTAINER" sh -lc 'curl -sf http://localhost:8081/subjects > /dev/null' 2>/dev/null; then
        echo "ok"
    else
        echo "failed"
    fi
}

echo "============================================================"
echo " Phase 1 Smoke Test — $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================================"
echo ""
echo "--- Container health ---"
check "Kafka broker 1" "$(docker_healthy "$KAFKA_CONTAINER")"
check "Kafka broker 2" "$(docker_healthy "$KAFKA_BROKER_2_CONTAINER")"
check "Schema Registry" "$(docker_healthy "$SCHEMA_REGISTRY_CONTAINER")"
check "Kafka Connect" "$(docker_healthy "$CONNECT_CONTAINER")"
check "Source PostgreSQL" "$(source_postgres_ready)"
check "Spark master" "$(docker_healthy "$SPARK_MASTER_CONTAINER")"
check "Spark worker" "$(docker_healthy "$SPARK_WORKER_CONTAINER")"
check "Redis" "$(docker_healthy "$REDIS_CONTAINER")"
check "Qdrant" "$(docker_healthy "$QDRANT_CONTAINER")"

echo ""
echo "--- Core readiness ---"
check "Kafka metadata" "$(kafka_metadata_ready)"
check "Schema Registry API" "$(schema_registry_ready)"
check "Kafka Connect API" "$(http_ok "$CONNECT_URL/connectors")"
check "Connect plugins" "$(connect_plugins_ready)" "expected Debezium plugins missing"
check "Avro converter jars" "$(avro_converter_ready)" "expected Avro converter jars missing"
check "Reference CDC assets" "$(reference_cdc_assets_ready)" "reference connector assets missing"
check "Metadata CDC assets" "$(metadata_cdc_assets_ready)" "metadata connector assets missing"
check "News CDC assets" "$(news_cdc_assets_ready)" "news connector assets missing"
check "Spark master UI" "$(http_ok "$SPARK_MASTER_URL")"
check "Spark worker UI" "$(http_ok "$SPARK_WORKER_URL")"
check "Spark worker registered" "$(spark_worker_registered)" "worker not visible from master"
check "Redis ping" "$(redis_ping)"
check "Qdrant collections API" "$(http_ok "$QDRANT_URL/collections")"

echo ""
echo "============================================================"
echo " Summary: ${PASS} passed, ${FAIL} failed"
echo "============================================================"

[[ $FAIL -eq 0 ]]
