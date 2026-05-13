#!/usr/bin/env bash
# Reset processing state.
#
# Default: truncate articles/projection_state, delete topics + consumer groups,
#          flush Redis, reset Qdrant collection, clear Spark checkpoints.
#          Preserves dimensions, taxonomy, and topic embeddings.
#
# --full:   Also drop all processing tables including dimensions and taxonomy.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "${ROOT_DIR}/scripts/lib/processing.sh"

MODE="${1:-}"

if [[ -n "${MODE}" && "${MODE}" != "--full" ]]; then
  echo "Usage: $0 [--full]" >&2
  exit 2
fi

# Stop and remove processing containers
docker rm -f \
  imperium-canonical-enrichment-driver \
  imperium-classification-driver \
  imperium-topic-embedding-driver \
  imperium-dimension-reference-driver \
  imperium-dimension-authority-driver \
  imperium-dimension-links-driver \
  imperium-redis-projector \
  imperium-postgres-projector \
  imperium-qdrant-projector >/dev/null 2>&1 || true

if [[ "${MODE}" == "--full" ]]; then
  pg_exec <<'SQL'
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
  echo "Dropped all processing and dimension tables."
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
  echo "Truncated articles and projection_state tables."
fi

# Delete processing Kafka topics
for topic in \
  imperium.canonical-articles \
  imperium.canonical-articles.dlq \
  imperium.news.classified \
  imperium.news.classified.dlq
do
  kafka_exec kafka-topics --bootstrap-server "${KAFKA_BOOTSTRAP}" \
    --delete --if-exists --topic "${topic}" >/dev/null 2>&1 || true
done

# Purge Schema Registry subjects (prevents HTTP 409 after schema changes)
SCHEMA_REGISTRY_CONTAINER="${SCHEMA_REGISTRY_CONTAINER:-imperium-schema-registry}"
SCHEMA_REGISTRY_INTERNAL="${SCHEMA_REGISTRY_INTERNAL_URL:-http://schema-registry:8081}"
for subject in imperium.canonical-articles-value imperium.news.classified-value; do
  docker exec -i "${SCHEMA_REGISTRY_CONTAINER}" \
    curl -fsS -X DELETE "${SCHEMA_REGISTRY_INTERNAL}/subjects/${subject}" >/dev/null 2>&1 || true
  docker exec -i "${SCHEMA_REGISTRY_CONTAINER}" \
    curl -fsS -X DELETE "${SCHEMA_REGISTRY_INTERNAL}/subjects/${subject}?permanent=true" >/dev/null 2>&1 || true
done

# Delete Kafka consumer groups
ALL_GROUPS=$(kafka_exec kafka-consumer-groups --bootstrap-server "${KAFKA_BOOTSTRAP}" --list 2>/dev/null || true)
MATCHED=$(echo "${ALL_GROUPS}" | grep -E 'imperium-(redis|postgres|qdrant)-projector|canonical|classification|enrichment' || true)
if [[ -n "${MATCHED}" ]]; then
  while IFS= read -r group; do
    [[ -z "${group}" ]] && continue
    kafka_exec kafka-consumer-groups --bootstrap-server "${KAFKA_BOOTSTRAP}" \
      --delete --group "${group}" >/dev/null 2>&1 || true
  done <<< "${MATCHED}"
fi

# Flush Redis article/feed keys
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

# Reset Qdrant collection
qdrant_request -X DELETE "${QDRANT_URL}/collections/imperium_articles" >/dev/null 2>&1 || true
qdrant_request -X PUT "${QDRANT_URL}/collections/imperium_articles" \
  -H 'Content-Type: application/json' \
  -d '{"vectors":{"size":768,"distance":"Cosine"}}' >/dev/null

# Clear Spark checkpoints from named volume
docker run --rm \
  -v imperium-processing-checkpoints:/tmp/imperium/checkpoints \
  alpine:3.20 \
  sh -c "rm -rf /tmp/imperium/checkpoints/* 2>/dev/null" >/dev/null 2>&1 || true

if [[ "${MODE}" == "--full" ]]; then
  echo "Full reset done. All processing state and tables cleared."
else
  echo "Processing state cleaned. Preserved dimensions, taxonomy, and topic embeddings."
fi
