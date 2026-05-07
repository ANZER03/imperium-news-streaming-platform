#!/usr/bin/env bash
# Full fresh reset + restart of the processing pipeline from offset 0.
#
# Steps:
#   1.  Stop and remove all processing containers
#   2.  Clear named volumes (Spark checkpoints + worker data)
#   3.  Delete processing Kafka topics
#   4.  Purge Schema Registry subjects
#   5.  Delete Kafka consumer groups
#   6.  Flush Redis
#   7.  Drop + recreate imperium_news_articles table
#   8.  Reset Qdrant collection
#   9.  Recreate Kafka topics (compact)
#   10. Seed topic taxonomy + embeddings
#   11. Start enrichment driver, classification driver, and projectors

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "${ROOT_DIR}/scripts/lib/processing.sh"

ALL_PROFILES="--profile backbone --profile source --profile serving --profile processing-infra"

PROCESSING_CONTAINERS=(
  imperium-canonical-enrichment-driver
  imperium-classification-driver
  imperium-redis-projector
  imperium-postgres-projector
  imperium-qdrant-projector
  imperium-topic-embedding-driver
)

SPARK_VOLUMES=(
  imperium-processing-checkpoints
  imperium-spark-events
  imperium-spark-master-data
  imperium-spark-worker-1-data
  imperium-spark-worker-2-data
  imperium-spark-worker-3-data
)

SCHEMA_REGISTRY_CONTAINER="${SCHEMA_REGISTRY_CONTAINER:-imperium-schema-registry}"
SCHEMA_REGISTRY_INTERNAL="${SCHEMA_REGISTRY_INTERNAL_URL:-http://schema-registry:8081}"

wait_for_log() {
  local container="$1"
  local pattern="$2"
  local timeout="${3:-60}"
  local elapsed=0
  while (( elapsed < timeout )); do
    docker logs "${container}" 2>&1 | grep -qE "${pattern}" && return 0
    sleep 3
    (( elapsed += 3 ))
  done
  printf 'Timed out waiting for "%s" in %s logs.\n' "${pattern}" "${container}" >&2
  return 1
}

# ─── 1. Stop & remove processing containers ───────────────────────────────────
echo "==> [1/11] Stopping processing containers..."
docker rm -f "${PROCESSING_CONTAINERS[@]}" 2>/dev/null || true

# ─── 2. Clear named volumes ───────────────────────────────────────────────────
echo "==> [2/11] Clearing Spark volumes..."
for vol in "${SPARK_VOLUMES[@]}"; do
  docker run --rm -v "${vol}:/data" alpine \
    sh -c "rm -rf /data/* /data/.[!.]* 2>/dev/null" 2>/dev/null \
    && echo "  cleared: ${vol}" || echo "  skipped (not found): ${vol}"
done

# ─── 3. Delete processing Kafka topics ───────────────────────────────────────
echo "==> [3/11] Deleting Kafka topics..."
for topic in \
  imperium.canonical-articles \
  imperium.canonical-articles.dlq \
  imperium.news.classified \
  imperium.news.classified.dlq
do
  kafka_exec kafka-topics --bootstrap-server "${KAFKA_BOOTSTRAP}" \
    --delete --if-exists --topic "${topic}" 2>/dev/null || true
  echo "  deleted: ${topic}"
done

# ─── 4. Purge Schema Registry subjects ───────────────────────────────────────
echo "==> [4/11] Purging Schema Registry subjects..."
for subject in imperium.canonical-articles-value imperium.news.classified-value; do
  docker exec -i "${SCHEMA_REGISTRY_CONTAINER}" \
    curl -fsS -X DELETE "${SCHEMA_REGISTRY_INTERNAL}/subjects/${subject}" 2>/dev/null || true
  docker exec -i "${SCHEMA_REGISTRY_CONTAINER}" \
    curl -fsS -X DELETE "${SCHEMA_REGISTRY_INTERNAL}/subjects/${subject}?permanent=true" 2>/dev/null || true
  echo "  purged: ${subject}"
done

# ─── 5. Delete Kafka consumer groups ─────────────────────────────────────────
echo "==> [5/11] Deleting consumer groups..."
ALL_GROUPS=$(kafka_exec kafka-consumer-groups --bootstrap-server "${KAFKA_BOOTSTRAP}" --list 2>/dev/null || true)
MATCHED=$(echo "${ALL_GROUPS}" | grep -E 'imperium-(redis|postgres|qdrant)-projector|canonical|classification|enrichment' || true)
if [[ -n "${MATCHED}" ]]; then
  while IFS= read -r group; do
    [[ -z "${group}" ]] && continue
    kafka_exec kafka-consumer-groups --bootstrap-server "${KAFKA_BOOTSTRAP}" \
      --delete --group "${group}" 2>/dev/null || true
    echo "  deleted: ${group}"
  done <<< "${MATCHED}"
else
  echo "  no matching groups found"
fi

# ─── 6. Flush Redis ──────────────────────────────────────────────────────────
echo "==> [6/11] Flushing Redis..."
docker exec imperium-redis redis-cli FLUSHALL

# ─── 7. Recreate imperium_news_articles table ─────────────────────────────────
echo "==> [7/11] Recreating imperium_news_articles..."
pg_exec -f /dev/stdin << 'SQL'
DROP TABLE IF EXISTS imperium_news_articles;
CREATE TABLE imperium_news_articles (
    article_id              TEXT PRIMARY KEY,
    source_news_id          BIGINT,
    link_id                 BIGINT,
    authority_id            BIGINT,
    country_id              INTEGER,
    country_name            TEXT,
    source_name             TEXT,
    source_domain           TEXT,
    rubric_id               INTEGER,
    rubric_title            TEXT,
    language_id             INTEGER,
    language_code           VARCHAR(10),
    classification_status   VARCHAR(50) NOT NULL DEFAULT 'pending',
    classification_method   TEXT,
    classification_model    TEXT,
    root_topic_id           TEXT,
    root_topic_label        TEXT,
    primary_topic_id        TEXT,
    primary_topic_label     TEXT,
    topic_confidence        DOUBLE PRECISION,
    topic_candidates        JSONB,
    title                   TEXT,
    url                     TEXT,
    body_text               TEXT,
    body_text_clean         TEXT,
    excerpt                 TEXT,
    image_url               TEXT,
    video_url               TEXT,
    reporter                TEXT,
    source_date_text        TEXT,
    published_at            BIGINT,
    crawled_at              BIGINT,
    is_video                BOOLEAN,
    dimension_status        VARCHAR(50),
    missing_dimensions      JSONB,
    schema_version          INTEGER,
    processed_at            TIMESTAMP,
    is_delete               BOOLEAN,
    classified_at           TIMESTAMP,
    embedding_vector        REAL[],
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
SQL

# ─── 8. Reset Qdrant collection ───────────────────────────────────────────────
echo "==> [8/11] Resetting Qdrant collection..."
curl -fsS -X DELETE "${QDRANT_URL}/collections/imperium_articles" 2>/dev/null || true
curl -fsS -X PUT "${QDRANT_URL}/collections/imperium_articles" \
  -H 'Content-Type: application/json' \
  -d '{"vectors":{"size":768,"distance":"Cosine"}}' >/dev/null
echo "  imperium_articles recreated (dim=768, Cosine)"

# ─── 9. Recreate Kafka topics ─────────────────────────────────────────────────
echo "==> [9/11] Recreating Kafka topics..."
kafka_exec kafka-topics --bootstrap-server "${KAFKA_BOOTSTRAP}" \
  --create --if-not-exists --topic imperium.canonical-articles \
  --partitions 3 --replication-factor 1 \
  --config cleanup.policy=compact \
  --config retention.ms=604800000 \
  --config min.compaction.lag.ms=60000 2>/dev/null
kafka_exec kafka-topics --bootstrap-server "${KAFKA_BOOTSTRAP}" \
  --create --if-not-exists --topic imperium.canonical-articles.dlq \
  --partitions 1 --replication-factor 1 \
  --config cleanup.policy=delete \
  --config retention.ms=604800000 2>/dev/null
kafka_exec kafka-topics --bootstrap-server "${KAFKA_BOOTSTRAP}" \
  --create --if-not-exists --topic imperium.news.classified \
  --partitions 3 --replication-factor 1 \
  --config cleanup.policy=compact \
  --config retention.ms=604800000 \
  --config min.compaction.lag.ms=60000 \
  --config max.message.bytes=2097152 2>/dev/null
kafka_exec kafka-topics --bootstrap-server "${KAFKA_BOOTSTRAP}" \
  --create --if-not-exists --topic imperium.news.classified.dlq \
  --partitions 1 --replication-factor 1 \
  --config cleanup.policy=delete \
  --config retention.ms=604800000 2>/dev/null

# ─── 10. Seed topic taxonomy + embeddings ─────────────────────────────────────
echo "==> [10/11] Seeding topic taxonomy and embeddings..."
compose ${ALL_PROFILES} --profile processing up -d --force-recreate --no-deps imperium-topic-embedding-driver
until [[ "$(docker inspect -f '{{.State.Status}}' imperium-topic-embedding-driver 2>/dev/null)" != "running" ]]; do
  sleep 3
done
EXIT_CODE=$(docker inspect -f '{{.State.ExitCode}}' imperium-topic-embedding-driver 2>/dev/null || echo "1")
if [[ "${EXIT_CODE}" != "0" ]]; then
  echo "ERROR: topic embedding driver failed (exit ${EXIT_CODE})." >&2
  docker logs imperium-topic-embedding-driver 2>&1 | tail -20 >&2
  exit 1
fi
docker logs imperium-topic-embedding-driver 2>&1 | tail -3

# ─── 11. Start drivers and projectors ─────────────────────────────────────────
echo "==> [11/11] Starting processing services..."

compose ${ALL_PROFILES} --profile processing up -d --no-deps imperium-canonical-enrichment-driver
echo "  waiting for enrichment driver..."
wait_for_log imperium-canonical-enrichment-driver "Initial offsets|ERROR|Exception" 90

compose ${ALL_PROFILES} --profile processing up -d --no-deps imperium-classification-driver
echo "  waiting for classification driver..."
wait_for_log imperium-classification-driver "Starting Classification|Schema registered|ERROR" 90

compose ${ALL_PROFILES} --profile processing up -d --no-deps \
  imperium-redis-projector \
  imperium-postgres-projector \
  imperium-qdrant-projector
echo "  waiting for projectors..."
wait_for_log imperium-redis-projector    "Connected|pipeline executed|Subscribed|ERROR" 60
wait_for_log imperium-postgres-projector "Connected|Upserted|Assigned|ERROR" 60
wait_for_log imperium-qdrant-projector   "Connected|Upserted|Assigned|ERROR" 60

echo ""
echo "================================================================"
echo " Fresh reset complete. Pipeline is live from offset 0."
echo " Run 'make processing-logs' to follow all service logs."
echo "================================================================"
