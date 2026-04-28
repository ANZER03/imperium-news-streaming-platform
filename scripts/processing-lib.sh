#!/usr/bin/env bash

set -euo pipefail

COMPOSE_BIN="${COMPOSE:-docker-compose}"
ENV_FILE_PATH="${ENV_FILE:-.env}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-imperium-news-source-db}"
KAFKA_CONTAINER="${KAFKA_CONTAINER:-imperium-kafka-1}"
KAFKA_BOOTSTRAP="${KAFKA_BOOTSTRAP:-kafka:29092}"
REDIS_CONTAINER="${REDIS_CONTAINER:-imperium-redis}"
QDRANT_CONTAINER="${QDRANT_CONTAINER:-imperium-qdrant}"
QDRANT_URL="${QDRANT_URL:-http://localhost:46333}"
PROCESSING_CHECKPOINT_ROOT="${PROCESSING_CHECKPOINT_ROOT:-/tmp/imperium/checkpoints/processing}"
DIMENSION_CHECKPOINT_ROOT="${DIMENSION_CHECKPOINT_ROOT:-/tmp/imperium/checkpoints/dimensions}"
POSTGRES_DB="${POSTGRES_DB:-imperium-news-source}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DSN="${POSTGRES_DSN:-postgresql://${POSTGRES_USER}:postgres@postgres-source:5432/${POSTGRES_DB}}"

compose() {
  "${COMPOSE_BIN}" --env-file "${ENV_FILE_PATH}" "$@"
}

pg_exec() {
  docker exec -i "${POSTGRES_CONTAINER}" psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" "$@"
}

kafka_exec() {
  docker exec -i "${KAFKA_CONTAINER}" "$@"
}

redis_exec() {
  docker exec -i "${REDIS_CONTAINER}" redis-cli "$@"
}

qdrant_request() {
  curl -fsS "$@"
}
