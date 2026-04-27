#!/usr/bin/env bash

set -euo pipefail

source "$(dirname "$0")/processing-lib.sh"

MODE="${1:-downstream}"

if [[ "${MODE}" != "downstream" && "${MODE}" != "--refactor-reset" && "${MODE}" != "--full-reset" ]]; then
  echo "Usage: $0 [--refactor-reset|--full-reset]" >&2
  exit 2
fi

pg_exec -f /dev/stdin < scripts/processing-migrate.sql

processing_containers=(
  imperium-phase3-dimension-driver \
  imperium-phase3-canonical-driver \
  imperium-phase3-classification-driver \
  imperium-phase3-redis-driver \
  imperium-phase3-redis-topics-driver \
  imperium-phase3-qdrant-driver \
  imperium-phase3-topic-embedding-driver \
  imperium-topic-embedding-driver \
  imperium-dimension-driver \
  imperium-canonical-driver \
  imperium-classification-driver \
  imperium-redis-projector \
  imperium-postgres-projector \
  imperium-qdrant-projector
)

docker rm -f "${processing_containers[@]}" >/dev/null 2>&1 || true

if [[ "${MODE}" == "--refactor-reset" ]]; then
  compose --profile processing stop \
    spark-history-server \
    spark-worker-3 \
    spark-worker-2 \
    spark-worker \
    spark-master >/dev/null 2>&1 || true

  compose --profile serving stop \
    redis-ui \
    qdrant \
    redis >/dev/null 2>&1 || true

  docker rm -f \
    imperium-spark-history-server \
    imperium-spark-worker-3 \
    imperium-spark-worker-2 \
    imperium-spark-worker-1 \
    imperium-spark-master \
    imperium-qdrant \
    imperium-redis >/dev/null 2>&1 || true

  docker volume rm -f \
    imperium-redis-data \
    imperium-qdrant-data \
    imperium-processing-checkpoints \
    imperium-spark-master-data \
    imperium-spark-worker-1-data \
    imperium-spark-worker-2-data \
    imperium-spark-worker-3-data \
    imperium-spark-events >/dev/null 2>&1 || true

  pg_exec <<'SQL'
DROP TABLE IF EXISTS public.phase3_projection_state;
DROP TABLE IF EXISTS public.phase3_cleaned_articles;
DROP TABLE IF EXISTS public.phase3_topic_embeddings;
DROP TABLE IF EXISTS public.phase3_topic_taxonomy;
DROP TABLE IF EXISTS public.phase3_dim_links;
DROP TABLE IF EXISTS public.phase3_dim_authorities;
DROP TABLE IF EXISTS public.phase3_dim_seditions;
DROP TABLE IF EXISTS public.phase3_dim_countries;
DROP TABLE IF EXISTS public.phase3_dim_rubrics;
DROP TABLE IF EXISTS public.phase3_dim_languages;
DROP TABLE IF EXISTS public.imperium_projection_state;
DROP TABLE IF EXISTS public.imperium_articles;
DROP TABLE IF EXISTS public.imperium_topic_embeddings;
DROP TABLE IF EXISTS public.imperium_topic_taxonomy;
DROP TABLE IF EXISTS public.imperium_dim_links;
DROP TABLE IF EXISTS public.imperium_dim_authorities;
DROP TABLE IF EXISTS public.imperium_dim_seditions;
DROP TABLE IF EXISTS public.imperium_dim_countries;
DROP TABLE IF EXISTS public.imperium_dim_rubrics;
DROP TABLE IF EXISTS public.imperium_dim_languages;
SQL
elif [[ "${MODE}" == "--full-reset" ]]; then
  compose --profile processing stop \
    spark-history-server \
    spark-worker-3 \
    spark-worker-2 \
    spark-worker \
    spark-master \
    imperium-dimension-driver \
    imperium-canonical-driver \
    imperium-classification-driver \
    imperium-redis-projector \
    imperium-postgres-projector \
    imperium-qdrant-projector >/dev/null 2>&1 || true

  pg_exec <<'SQL'
DROP TABLE IF EXISTS public.phase3_projection_state;
DROP TABLE IF EXISTS public.phase3_cleaned_articles;
DROP TABLE IF EXISTS public.phase3_topic_embeddings;
DROP TABLE IF EXISTS public.phase3_topic_taxonomy;
DROP TABLE IF EXISTS public.phase3_dim_links;
DROP TABLE IF EXISTS public.phase3_dim_authorities;
DROP TABLE IF EXISTS public.phase3_dim_seditions;
DROP TABLE IF EXISTS public.phase3_dim_countries;
DROP TABLE IF EXISTS public.phase3_dim_rubrics;
DROP TABLE IF EXISTS public.phase3_dim_languages;
DROP TABLE IF EXISTS public.imperium_projection_state;
DROP TABLE IF EXISTS public.imperium_articles;
DROP TABLE IF EXISTS public.imperium_topic_embeddings;
DROP TABLE IF EXISTS public.imperium_topic_taxonomy;
DROP TABLE IF EXISTS public.imperium_dim_links;
DROP TABLE IF EXISTS public.imperium_dim_authorities;
DROP TABLE IF EXISTS public.imperium_dim_seditions;
DROP TABLE IF EXISTS public.imperium_dim_countries;
DROP TABLE IF EXISTS public.imperium_dim_rubrics;
DROP TABLE IF EXISTS public.imperium_dim_languages;
SQL
else
  pg_exec <<'SQL'
DO $$
BEGIN
    IF to_regclass('public.imperium_articles') IS NOT NULL THEN
        EXECUTE 'TRUNCATE TABLE public.imperium_articles RESTART IDENTITY';
    END IF;
    IF to_regclass('public.imperium_projection_state') IS NOT NULL THEN
        EXECUTE 'TRUNCATE TABLE public.imperium_projection_state RESTART IDENTITY';
    END IF;
END $$;
SQL
fi

topics=(
  phase3.canonical-articles
  phase3.canonical-articles.dlq
  imperium.canonical-articles
  imperium.canonical-articles.dlq
)
for topic in "${topics[@]}"; do
  kafka_exec kafka-topics --bootstrap-server "${KAFKA_BOOTSTRAP}" --delete --if-exists --topic "${topic}" >/dev/null 2>&1 || true
done

if [[ "${MODE}" != "--refactor-reset" ]]; then
  kafka_exec kafka-topics --bootstrap-server "${KAFKA_BOOTSTRAP}" --create --if-not-exists --topic imperium.canonical-articles --partitions 3 --replication-factor 1 --config cleanup.policy=compact --config retention.ms=604800000 --config min.compaction.lag.ms=60000
  kafka_exec kafka-topics --bootstrap-server "${KAFKA_BOOTSTRAP}" --create --if-not-exists --topic imperium.canonical-articles.dlq --partitions 1 --replication-factor 1 --config cleanup.policy=delete --config retention.ms=604800000
fi

if [[ "${MODE}" != "--refactor-reset" ]]; then
  article_keys="$(redis_exec --scan --pattern 'article:*' || true)"
  if [[ -n "${article_keys}" ]]; then
    while IFS= read -r key; do
      [[ -z "${key}" ]] && continue
      redis_exec DEL "${key}" >/dev/null
    done <<< "${article_keys}"
  fi

  feed_keys="$(redis_exec --scan --pattern 'feed:*' || true)"
  if [[ -n "${feed_keys}" ]]; then
    while IFS= read -r key; do
      [[ -z "${key}" ]] && continue
      redis_exec DEL "${key}" >/dev/null
    done <<< "${feed_keys}"
  fi

  qdrant_request -X DELETE "${QDRANT_URL}/collections/phase3_articles" >/dev/null 2>&1 || true
  qdrant_request -X DELETE "${QDRANT_URL}/collections/imperium_articles" >/dev/null 2>&1 || true
  qdrant_request -X PUT "${QDRANT_URL}/collections/imperium_articles" \
    -H 'Content-Type: application/json' \
    -d '{"vectors":{"size":768,"distance":"Cosine"}}' >/dev/null
fi

docker exec -i imperium-spark-master bash -lc "rm -rf '${PROCESSING_CHECKPOINT_ROOT}' '/tmp/imperium/phase3/checkpoints-live' '/tmp/imperium/phase3/checkpoints-qdrant-replay' '/tmp/imperium/phase3/checkpoints-redis-topics'" >/dev/null 2>&1 || true
docker exec -i imperium-spark-worker-1 bash -lc "rm -rf '${PROCESSING_CHECKPOINT_ROOT}' '/tmp/imperium/phase3/checkpoints-live' '/tmp/imperium/phase3/checkpoints-qdrant-replay' '/tmp/imperium/phase3/checkpoints-redis-topics'" >/dev/null 2>&1 || true
docker exec -i imperium-spark-worker-2 bash -lc "rm -rf '${PROCESSING_CHECKPOINT_ROOT}' '/tmp/imperium/phase3/checkpoints-live' '/tmp/imperium/phase3/checkpoints-qdrant-replay' '/tmp/imperium/phase3/checkpoints-redis-topics'" >/dev/null 2>&1 || true
docker exec -i imperium-spark-worker-3 bash -lc "rm -rf '${PROCESSING_CHECKPOINT_ROOT}' '/tmp/imperium/phase3/checkpoints-live' '/tmp/imperium/phase3/checkpoints-qdrant-replay' '/tmp/imperium/phase3/checkpoints-redis-topics'" >/dev/null 2>&1 || true
docker run --rm \
  -v imperium-processing-checkpoints:/tmp/imperium/checkpoints \
  alpine:3.20 \
  sh -lc "rm -rf '${PROCESSING_CHECKPOINT_ROOT}' '/tmp/imperium/phase3/checkpoints-live' '/tmp/imperium/phase3/checkpoints-qdrant-replay' '/tmp/imperium/phase3/checkpoints-redis-topics'" >/dev/null 2>&1 || true

group_ids="$(kafka_exec kafka-consumer-groups --bootstrap-server "${KAFKA_BOOTSTRAP}" --list 2>/dev/null | grep -E 'phase3|canonical|classification|redis|qdrant|dimension|topic-embedding' || true)"
if [[ -n "${group_ids}" ]]; then
  while IFS= read -r group_id; do
    [[ -z "${group_id}" ]] && continue
    kafka_exec kafka-consumer-groups --bootstrap-server "${KAFKA_BOOTSTRAP}" --delete --group "${group_id}" >/dev/null 2>&1 || true
  done <<< "${group_ids}"
else
  echo "No processing-related Kafka consumer groups found."
fi

if [[ "${MODE}" == "--refactor-reset" ]]; then
  compose --profile processing up -d spark-master spark-worker spark-worker-2 spark-worker-3
  echo "Processing refactor reset cleaned. Redis/Qdrant remain stopped; only Spark master/workers were restarted."
elif [[ "${MODE}" == "--full-reset" ]]; then
  echo "Processing full reset cleaned. Processing drivers remain stopped and processing-owned state is empty."
else
  echo "Processing state cleaned. Preserved dimensions, taxonomy, and topic embeddings."
fi
