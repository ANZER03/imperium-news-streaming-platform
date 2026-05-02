# Imperium — Stack Runbook

All commands assume you are in the repo root and `.env` exists.  
Default variable: `ENV_FILE=.env`.

---

## 1. Ingestion Stack

**Services:** postgres-source · kafka · kafka-broker-2 · schema-registry · kafka-connect (Debezium)

> **Makefile shortcut:** `make cdc-up`  
> Does more than just `up` — it also registers the three CDC connectors (reference, metadata, news) and emits initial snapshot signals. Use it for a first-time or post-reset bring-up.

**Raw docker-compose (containers only, no connector registration):**
```bash
docker-compose --env-file .env \
  --profile backbone --profile source --profile processing \
  up -d \
  kafka kafka-broker-2 schema-registry postgres-source kafka-connect
```

**Verify connectors are RUNNING:**
```bash
curl -s http://localhost:48083/connectors?expand=status | python3 -m json.tool
```
All three connectors (`imperium-reference-cdc`, `imperium-metadata-cdc`, `imperium-news-cdc`) must show `"state": "RUNNING"`.

---

## 2. Processing Stack

**Services:** spark-master · spark-worker (×3) · spark-history-server · llama-cpp · dimension drivers (×3) · enrichment driver · classification driver

> **Makefile shortcut:** `make processing-up`  
> Wraps `scripts/processing-up.sh`. Starts infra then each driver sequentially.

**Raw docker-compose — Step 1: Spark cluster + llama-cpp (wait for healthy before drivers):**
```bash
docker-compose --env-file .env \
  --profile backbone --profile source --profile serving --profile processing \
  up -d \
  kafka kafka-broker-2 schema-registry postgres-source redis qdrant \
  spark-master spark-worker spark-worker-2 spark-worker-3 spark-history-server \
  llama-cpp
```

**Raw docker-compose — Step 2: Dimension drivers:**
```bash
docker-compose --env-file .env \
  --profile backbone --profile source --profile serving --profile processing \
  up -d \
  imperium-dimension-reference-driver \
  imperium-dimension-authority-driver \
  imperium-dimension-links-driver
```

**Raw docker-compose — Step 3: Content drivers:**
```bash
docker-compose --env-file .env \
  --profile backbone --profile source --profile serving --profile processing \
  up -d \
  imperium-canonical-enrichment-driver \
  imperium-classification-driver
```

**UIs:**
| Service | URL |
|---|---|
| Spark Master | http://localhost:48080 |
| Spark History | http://localhost:48082 |
| llama-cpp health | http://localhost:18080/health |

---

## 3. Storage Stack

**Services:** redis · qdrant · postgres-source · imperium-redis-projector · imperium-postgres-projector · imperium-qdrant-projector

> No dedicated Makefile target for storage-only. Projectors are also started by `make processing-up`.

**Raw docker-compose:**
```bash
# Storage backends
docker-compose --env-file .env \
  --profile serving --profile source \
  up -d \
  redis qdrant postgres-source

# Projection services (need kafka + schema-registry running first)
docker-compose --env-file .env \
  --profile backbone --profile source --profile serving --profile processing \
  up -d \
  imperium-redis-projector \
  imperium-postgres-projector \
  imperium-qdrant-projector
```

**Check health:**
```bash
docker exec imperium-redis redis-cli ping          # → PONG
curl -s http://localhost:46333/healthz             # → {"title":"healthz","status":"ok"}
```

---

## 4. Full Stack (Ingestion → Processing → Storage)

> **Makefile:** `make cdc-up && make processing-up`  
> This is the recommended path — `cdc-up` handles connector registration, then `processing-up` brings up Spark + drivers + projectors.

**Raw docker-compose (all at once — no connector registration, no signal emit):**
```bash
docker-compose --env-file .env \
  --profile backbone --profile source --profile serving --profile processing \
  up -d
```

> This starts every service in all four profiles but skips CDC connector registration.  
> For a proper first-time start, use the Makefile flow below.

**Recommended full start sequence:**
```bash
# 1. Bring up ingestion + register CDC connectors
make cdc-up

# 2. Verify connectors
make cdc-verify

# 3. Bring up processing (Spark, llama-cpp, drivers, projectors)
make processing-up
```

**Recommended full stop:**
```bash
make backend-down
```

---

## 5. Clone News Data from Prod

Fetch a slice of `table_news` from production and append it into the local `postgres-source` (skips conflicts).  
Script: `scripts/clone-news-from-prod.py`

**Arguments:**

| Argument | Description |
|---|---|
| `--from-id` | Fetch rows where `id > <value>` |
| `--size` | Number of rows (`ORDER BY id ASC LIMIT <size>`) |

**Run:**
```bash
python scripts/clone-news-from-prod.py --from-id <id> --size <rows>
```

**Example:**
```bash
python scripts/clone-news-from-prod.py --from-id 565170965 --size 10000
```

After a successful run, the last imported id is saved to:
```
infra/source-db-clone/.state/clone-news-last-id.json
```

> Requires `.env.prod` with `PROD_PGHOST`, `PROD_PGPORT`, `PROD_PGDATABASE`, `PROD_PGUSER`, `PROD_PGPASSWORD`.

---

## Quick Reference

| Goal | Command |
|---|---|
| Start ingestion only | `make cdc-up` |
| Verify CDC connectors | `make cdc-verify` |
| Start processing only | `make processing-up` |
| Start everything | `make cdc-up && make processing-up` |
| Stop everything | `make backend-down` |
| Stream all logs | `make backend-logs` |
| Stream processing logs | `make processing-logs` |
| Full reset from zero | `make clean-all-from-source` |
| Reset processing only | `make processing-clean && make processing-up` |

---

## 6. Topic Taxonomy & Embedding Seed

Populates `imperium_topic_taxonomy` and `imperium_topic_embeddings` tables using the medtop JSON taxonomy and llama-cpp embeddings. Drops and recreates both tables on every run (idempotent).

**Run:**
```bash
docker-compose --env-file .env \
  --profile processing --profile backbone --profile source --profile serving \
  up -d --force-recreate --no-deps \
  imperium-topic-embedding-driver
```

**Follow logs:**
```bash
docker logs -f imperium-topic-embedding-driver
```

**Verify — taxonomy rows and embedding dimension:**
```bash
docker exec imperium-news-source-db psql -U postgres -d imperium-news-source -c "
SELECT topic_id,
       jsonb_array_length(embedding_seeds)   AS seeds,
       jsonb_array_length(signals_strong)    AS sig_strong,
       jsonb_array_length(dimensions_actors) AS dim_actors
FROM imperium_topic_taxonomy ORDER BY topic_id;"

docker exec imperium-news-source-db psql -U postgres -d imperium-news-source -c "
SELECT topic_id, embedding_model, embedding_dimension
FROM imperium_topic_embeddings ORDER BY topic_id;"
```

Expected: 13 rows, `embedding_dimension = 768`.

---

## 7. Driver: Force-Recreate a Single Service (safe pattern)

Use `--force-recreate --no-deps` to restart one driver without touching sibling containers.  
> **Warning:** `--force-recreate` without `--no-deps` sends SIGTERM to all running project containers.

```bash
# Enrichment driver
docker-compose --env-file .env \
  --profile processing --profile backbone --profile source --profile serving \
  up -d --force-recreate --no-deps \
  imperium-canonical-enrichment-driver

# Classification driver
docker-compose --env-file .env \
  --profile processing --profile backbone --profile source --profile serving \
  up -d --force-recreate --no-deps \
  imperium-classification-driver

# Redis projector
docker-compose --env-file .env \
  --profile processing --profile backbone --profile source --profile serving \
  up -d --force-recreate --no-deps \
  imperium-redis-projector

# Postgres projector
docker-compose --env-file .env \
  --profile processing --profile backbone --profile source --profile serving \
  up -d --force-recreate --no-deps \
  imperium-postgres-projector

# Qdrant projector
docker-compose --env-file .env \
  --profile processing --profile backbone --profile source --profile serving \
  up -d --force-recreate --no-deps \
  imperium-qdrant-projector
```

**Safer alternative — restart without compose (preserves siblings):**
```bash
docker restart imperium-classification-driver
docker restart imperium-canonical-enrichment-driver
```

---

## 8. Schema Registry — Purge a Stale Subject

Run this before restarting a driver after any Avro schema change, or after an HTTP 409 from the registry (Issue 3 in `issues.md`).

```bash
# Soft-delete then permanent purge (both steps required)
docker exec imperium-schema-registry \
  curl -fsS -X DELETE "http://schema-registry:8081/subjects/imperium.news.classified-value"
docker exec imperium-schema-registry \
  curl -fsS -X DELETE "http://schema-registry:8081/subjects/imperium.news.classified-value?permanent=true"

# Canonical subject (if needed)
docker exec imperium-schema-registry \
  curl -fsS -X DELETE "http://schema-registry:8081/subjects/imperium.canonical-articles-value"
docker exec imperium-schema-registry \
  curl -fsS -X DELETE "http://schema-registry:8081/subjects/imperium.canonical-articles-value?permanent=true"

# List remaining subjects to confirm purge
docker exec imperium-schema-registry \
  curl -fsS http://schema-registry:8081/subjects
```

---

## 9. Kafka — Check Topic Offsets

```bash
# Total messages on canonical topic
docker exec imperium-kafka-1 kafka-get-offsets \
  --bootstrap-server imperium-kafka-1:29092 \
  --topic imperium.canonical-articles --time -1

# Total messages on classified topic
docker exec imperium-kafka-1 kafka-get-offsets \
  --bootstrap-server imperium-kafka-1:29092 \
  --topic imperium.news.classified --time -1
```

---

## 10. End-to-End Sanity Check

Run after all drivers and projectors are up to confirm the full pipeline is flowing.

```bash
# 1. Canonical topic has messages
docker exec imperium-kafka-1 kafka-get-offsets \
  --bootstrap-server imperium-kafka-1:29092 \
  --topic imperium.canonical-articles --time -1

# 2. Classified topic has messages
docker exec imperium-kafka-1 kafka-get-offsets \
  --bootstrap-server imperium-kafka-1:29092 \
  --topic imperium.news.classified --time -1

# 3. Redis has keys
docker exec imperium-redis redis-cli DBSIZE

# 4. Postgres has rows
docker exec imperium-news-source-db psql -U postgres -d imperium-news-source \
  -c "SELECT COUNT(*) FROM imperium_news_articles;"

# 5. Qdrant has points
curl -s http://localhost:46333/collections/imperium_articles \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print('points:', d['result']['points_count'])"

# 6. Taxonomy and embeddings seeded
docker exec imperium-news-source-db psql -U postgres -d imperium-news-source \
  -c "SELECT COUNT(*) FROM imperium_topic_taxonomy; SELECT COUNT(*) FROM imperium_topic_embeddings;"
```

Expected healthy state:
- Canonical + classified offsets growing
- Redis `DBSIZE > 0`
- Postgres `COUNT(*) > 0`
- Qdrant `points_count > 0`
- Taxonomy: 13 topics, 13 embeddings

---

## 11. Classification Embedding Test

Quick accuracy test — embeds 20 multilingual headlines and classifies them against topic vectors in Postgres.

```bash
docker exec \
  -e PHASE3_POSTGRES_DSN="postgresql://postgres:postgres@imperium-news-source-db:5432/imperium-news-source" \
  -e LLAMA_CPP_BASE_URL="http://llama-cpp:8080" \
  -e NVIDIA_EMBEDDING_MODEL="embeddinggemma-300M-Q8_0.gguf" \
  -e PYTHONPATH="/opt/imperium/news-pipeline/src" \
  imperium-canonical-enrichment-driver \
  python3 /opt/imperium/news-pipeline/jobs/test_classification_embedding.py
```

Expected: ≥ 90% accuracy across English, French, Spanish, Arabic samples.




