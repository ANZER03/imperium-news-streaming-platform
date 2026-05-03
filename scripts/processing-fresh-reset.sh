#!/usr/bin/env bash
# Full fresh reset + startup of the processing pipeline.
#
# Cleans: containers, named volumes (checkpoints + Spark data), Kafka topics,
#         Schema Registry subjects, consumer groups, Redis, Postgres articles
#         table, Qdrant collection.
#
# Then:   recreates topics (compact), seeds topic taxonomy + embeddings,
#         starts enrichment driver, classification driver, and all projectors.

set -euo pipefail

source "$(dirname "$0")/processing-lib.sh"

ALL_PROFILES="--profile backbone --profile source --profile serving --profile processing"

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

PROCESSING_TOPICS=(
  imperium.canonical-articles
  imperium.canonical-articles.dlq
  imperium.news.classified
)

SCHEMA_REGISTRY_SUBJECTS=(
  imperium.canonical-articles-value
  imperium.news.classified-value
)

SCHEMA_REGISTRY_CONTAINER="${SCHEMA_REGISTRY_CONTAINER:-imperium-schema-registry}"
SCHEMA_REGISTRY_INTERNAL="${SCHEMA_REGISTRY_INTERNAL_URL:-http://schema-registry:8081}"

# ─── STEP 1: Stop & remove all processing containers ─────────────────────────
echo "==> [1/11] Stopping and removing processing containers..."
docker rm -f "${PROCESSING_CONTAINERS[@]}" 2>/dev/null || true

# ─── STEP 2: Clear named volumes (checkpoints + Spark worker/master data) ─────
echo "==> [2/11] Clearing named volumes (checkpoints + Spark data)..."
for vol in "${SPARK_VOLUMES[@]}"; do
  docker run --rm -v "${vol}:/data" alpine \
    sh -c "rm -rf /data/* /data/.[!.]* 2>/dev/null && echo '  cleared: ${vol}'" 2>/dev/null \
    || echo "  skipped (volume not found): ${vol}"
done

# ─── STEP 3: Delete processing Kafka topics ───────────────────────────────────
echo "==> [3/11] Deleting processing Kafka topics..."
for topic in "${PROCESSING_TOPICS[@]}"; do
  kafka_exec kafka-topics --bootstrap-server "${KAFKA_BOOTSTRAP}" \
    --delete --if-exists --topic "${topic}" 2>/dev/null || true
  echo "  deleted: ${topic}"
done

# ─── STEP 4: Purge Schema Registry subjects (prevents HTTP 409 on restart) ───
echo "==> [4/11] Purging Schema Registry subjects..."
for subject in "${SCHEMA_REGISTRY_SUBJECTS[@]}"; do
  docker exec -i "${SCHEMA_REGISTRY_CONTAINER}" \
    curl -fsS -X DELETE "${SCHEMA_REGISTRY_INTERNAL}/subjects/${subject}" 2>/dev/null || true
  docker exec -i "${SCHEMA_REGISTRY_CONTAINER}" \
    curl -fsS -X DELETE "${SCHEMA_REGISTRY_INTERNAL}/subjects/${subject}?permanent=true" 2>/dev/null || true
  echo "  purged: ${subject}"
done

# ─── STEP 5: Delete Kafka consumer groups ─────────────────────────────────────
echo "==> [5/11] Deleting Kafka consumer groups..."
ALL_GROUPS=$(kafka_exec kafka-consumer-groups --bootstrap-server "${KAFKA_BOOTSTRAP}" --list 2>/dev/null || true)
PROCESSING_GROUP_PATTERN='imperium-(redis|postgres|qdrant)-projector|canonical|classification|enrichment|phase3'
MATCHED=$(echo "${ALL_GROUPS}" | grep -E "${PROCESSING_GROUP_PATTERN}" || true)
if [[ -n "${MATCHED}" ]]; then
  while IFS= read -r group; do
    [[ -z "${group}" ]] && continue
    kafka_exec kafka-consumer-groups --bootstrap-server "${KAFKA_BOOTSTRAP}" \
      --delete --group "${group}" 2>/dev/null || true
    echo "  deleted group: ${group}"
  done <<< "${MATCHED}"
else
  echo "  no matching consumer groups found"
fi

# ─── STEP 6: Flush Redis ──────────────────────────────────────────────────────
echo "==> [6/11] Flushing Redis..."
docker exec imperium-redis redis-cli FLUSHALL

# ─── STEP 7: Drop + recreate imperium_news_articles (all TEXT, no VARCHAR) ───
echo "==> [7/11] Recreating imperium_news_articles table..."
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

# ─── STEP 8: Reset Qdrant collection ─────────────────────────────────────────
echo "==> [8/11] Resetting Qdrant collection..."
curl -fsS -X DELETE "${QDRANT_URL}/collections/imperium_articles" 2>/dev/null || true
curl -fsS -X PUT "${QDRANT_URL}/collections/imperium_articles" \
  -H 'Content-Type: application/json' \
  -d '{"vectors":{"size":768,"distance":"Cosine"}}' > /dev/null
echo "  collection imperium_articles recreated (dim=768, Cosine)"

# ─── STEP 9: Recreate Kafka topics (compact) ─────────────────────────────────
echo "==> [9/11] Recreating Kafka topics (compact)..."
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
  --config min.compaction.lag.ms=60000 2>/dev/null

echo "  verifying topics..."
kafka_exec kafka-topics --bootstrap-server "${KAFKA_BOOTSTRAP}" \
  --describe --topic imperium.canonical-articles 2>/dev/null | grep -E "^Topic:|cleanup.policy"
kafka_exec kafka-topics --bootstrap-server "${KAFKA_BOOTSTRAP}" \
  --describe --topic imperium.news.classified 2>/dev/null | grep -E "^Topic:|cleanup.policy"

# ─── STEP 10: Seed topic taxonomy + embeddings ───────────────────────────────
echo "==> [10/11] Seeding topic taxonomy and embeddings..."
compose ${ALL_PROFILES} up -d --force-recreate --no-deps imperium-topic-embedding-driver

echo "  waiting for embedding driver to finish..."
until [ "$(docker inspect -f '{{.State.Status}}' imperium-topic-embedding-driver 2>/dev/null)" != "running" ]; do
  sleep 3
done

EXIT_CODE=$(docker inspect -f '{{.State.ExitCode}}' imperium-topic-embedding-driver 2>/dev/null || echo "1")
if [[ "${EXIT_CODE}" != "0" ]]; then
  echo "ERROR: topic embedding driver failed (exit ${EXIT_CODE}). Aborting." >&2
  docker logs imperium-topic-embedding-driver 2>&1 | tail -20 >&2
  exit 1
fi
docker logs imperium-topic-embedding-driver 2>&1 | tail -3

# ─── STEP 11: Start drivers and projectors ───────────────────────────────────
echo "==> [11/11] Starting processing services..."

echo "  starting enrichment driver..."
compose ${ALL_PROFILES} up -d --no-deps imperium-canonical-enrichment-driver

echo "  waiting for enrichment driver to reach offset 0..."
until docker logs imperium-canonical-enrichment-driver 2>&1 | grep -qE "Initial offsets|ERROR|Exception"; do
  sleep 2
done
ENRICH_LOG=$(docker logs imperium-canonical-enrichment-driver 2>&1 | grep -E "Initial offsets|ERROR" | tail -3)
echo "  ${ENRICH_LOG}"
if echo "${ENRICH_LOG}" | grep -q "ERROR"; then
  echo "ERROR: enrichment driver failed. Aborting." >&2
  exit 1
fi

echo "  starting classification driver..."
compose ${ALL_PROFILES} up -d --no-deps imperium-classification-driver

echo "  waiting for classification driver to initialize..."
until docker logs imperium-classification-driver 2>&1 | grep -qE "Schema registered|ERROR|Exception"; do
  sleep 2
done
docker logs imperium-classification-driver 2>&1 | grep -E "Schema registered|batch=|ERROR" | tail -3

echo "  starting projectors (redis, postgres, qdrant)..."
compose ${ALL_PROFILES} up -d --no-deps \
  imperium-redis-projector \
  imperium-postgres-projector \
  imperium-qdrant-projector

echo "  waiting for projectors to connect..."
until docker logs imperium-redis-projector 2>&1 | grep -qE "Connected|pipeline executed|ERROR"; do sleep 1; done
until docker logs imperium-postgres-projector 2>&1 | grep -qE "Connected|Upserted|ERROR"; do sleep 1; done
until docker logs imperium-qdrant-projector 2>&1 | grep -qE "Connected|Upserted|ERROR"; do sleep 1; done

echo ""
echo "  redis    → $(docker logs imperium-redis-projector 2>&1 | grep -E 'Connected|pipeline' | tail -1)"
echo "  postgres → $(docker logs imperium-postgres-projector 2>&1 | grep -E 'Connected|Upserted' | tail -1)"
echo "  qdrant   → $(docker logs imperium-qdrant-projector 2>&1 | grep -E 'Connected|Upserted' | tail -1)"

echo ""
echo "================================================================"
echo " Fresh reset + startup complete. Pipeline is live from offset 0."
echo " Run 'make processing-logs' to follow all service logs."
echo "================================================================"
