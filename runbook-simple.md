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
