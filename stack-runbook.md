# Stack Runbook — Imperium News Streaming Platform

Step-by-step guide to bring the full stack up and down in the correct order.

---

## Prerequisites

- Docker Engine 29+ installed
- `docker-compose` v2.20+ available (`docker-compose --version`)
- `.env` file present at project root with all required variables
- External volume `source-db` exists (created once via `make create-source-db` or the init script)

---

## Profiles Overview

| Profile | Services | Depends on |
|---|---|---|
| `source` | `news-source-db` (Postgres) | — |
| `backbone` | `kafka`, `kafka-broker-2`, `schema-registry`, `kafka-connect` | `source` already running |
| `serving` | `redis`, `qdrant`, `llama-cpp` | — |
| `processing-infra` | `spark-master`, `spark-worker-1/2/3` | — |
| `processing` | all Spark drivers | `backbone`, `serving`, `processing-infra` already running |
| `projectors` | `imperium-redis-projector`, `imperium-postgres-projector`, `imperium-qdrant-projector` | `backbone`, `serving`, `source` already running |
| `ui` | `kafka-ui`, `redis-ui`, `pg-ui` | `backbone`, `serving` already running |
| `migration` | `clone-news` (scheduler that pulls 2k rows/5min from prod) | `source` already running |

> **Note:** `depends_on` across profiles is not validated by Compose at parse time. Always bring profiles up in the order below to respect runtime dependencies.

---

## Bringing the Stack Up

### 1. Source database

```bash
docker-compose --profile source up -d
```

Wait until healthy:
```bash
docker inspect --format='{{.State.Health.Status}}' imperium-news-source-db
# expected: healthy
```

---

### 2. Backbone (Kafka + Connect)

```bash
docker-compose --profile backbone up -d
```

Services started: `kafka`, `kafka-broker-2`, `schema-registry`, `kafka-connect`

Verify Debezium connectors are running:
```bash
docker exec imperium-kafka-connect curl -s http://kafka-connect:8083/connectors | python3 -m json.tool
# expected: ["imperium-metadata-cdc", "imperium-reference-cdc", "imperium-news-cdc"]

for c in imperium-metadata-cdc imperium-reference-cdc imperium-news-cdc; do
  docker exec imperium-kafka-connect curl -s http://kafka-connect:8083/connectors/$c/status \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['name'], d['tasks'][0]['state'])"
done
# expected: all RUNNING
```

> If connectors show FAILED with `UnknownHostException: postgres-source`, update the hostname via REST:
> ```bash
> CONFIG=$(docker exec imperium-kafka-connect curl -s http://kafka-connect:8083/connectors/<name>/config)
> UPDATED=$(echo "$CONFIG" | python3 -c "import sys,json; d=json.load(sys.stdin); d['database.hostname']='news-source-db'; print(json.dumps(d))")
> docker exec imperium-kafka-connect curl -s -X PUT http://kafka-connect:8083/connectors/<name>/config \
>   -H "Content-Type: application/json" -d "$UPDATED"
> ```

---

### 3. Serving (Redis + Qdrant + LLM)

```bash
docker-compose --profile serving up -d
```

Services started: `redis`, `qdrant`, `llama-cpp`

---

### 4. Processing Infrastructure (Spark Cluster)

```bash
docker-compose --profile processing-infra up -d
```

Services started: `spark-master`, `spark-worker-1`, `spark-worker-2`, `spark-worker-3`

Spark UI available at: `http://localhost:48080`

---

### 5. Processing Drivers

Start all drivers at once:
```bash
docker-compose --profile backbone --profile serving --profile source --profile processing-infra up -d \
  imperium-canonical-enrichment-driver \
  imperium-classification-driver
```

Or start selectively by service name. Available drivers:
- `imperium-canonical-enrichment-driver`
- `imperium-classification-driver`
- `imperium-topic-embedding-driver`
- `imperium-dimension-reference-driver`
- `imperium-dimension-authority-driver`
- `imperium-dimension-links-driver`

Check driver logs:
```bash
docker logs -f imperium-canonical-enrichment-driver
docker logs -f imperium-classification-driver
```

---

### 6. Projectors (Redis / Postgres / Qdrant)

Projectors consume the Kafka `imperium.canonical-articles` and `imperium.news.classified` topics and write to their respective stores. They must be started with all upstream profiles in scope so cross-profile dependencies resolve:

```bash
docker-compose --profile backbone --profile source --profile serving --profile processing --profile processing-infra up -d --no-deps \
  imperium-redis-projector \
  imperium-postgres-projector \
  imperium-qdrant-projector
```

Verify each is healthy:
```bash
docker logs imperium-redis-projector    --tail 5   # expect "Subscribed to [...] entering micro-batch loop"
docker logs imperium-postgres-projector --tail 5   # expect "Connected to PostgreSQL successfully"
docker logs imperium-qdrant-projector   --tail 5   # expect "Upserted N vectors to Qdrant"
```

> **Important:** projector code is baked into the image (no bind mount). After any code or env-var change, rebuild before recreating:
> ```bash
> docker-compose ... up -d --build --no-deps imperium-postgres-projector
> ```
> See Issues 6 and 14 in `issues.md`.

---

### 7. Clone scheduler (optional, for development)

Continuously pulls 2 000 rows of `table_news` from prod every 5 minutes into the local source DB. Requires `.env.prod` with prod credentials.

Pre-seed the starting ID into the named volume (only needed the first time, or to skip ahead):

```bash
docker volume create imperium-news-streaming-platform_clone-news-state 2>/dev/null || true
docker run --rm \
  -v imperium-news-streaming-platform_clone-news-state:/state \
  alpine sh -c 'echo "{\"last_id\": <ID>}" > /state/clone-news-last-id.json'
```

Start the scheduler:

```bash
docker-compose --profile backbone --profile source --profile migration up -d --no-deps clone-news
```

Follow progress:
```bash
docker logs -f imperium-clone-news
```

Old-news backfill pulls historical rows where `id < 564990395`, in descending
ID order, 100 000 rows every 5 minutes. It stores the last batch minimum ID in
its own volume and stops when a batch returns zero rows:

```bash
docker-compose --profile backbone --profile source --profile migration up -d --no-deps clone-old-news
docker logs -f imperium-clone-old-news
```

---

### 8. UI (optional)

Must be started together with `backbone` and `serving` so cross-profile `depends_on` resolves:

```bash
docker-compose --profile backbone --profile serving --profile ui up -d
```

| UI | URL |
|---|---|
| Kafka UI | http://localhost:48089 |
| Redis UI (RedisInsight) | http://localhost:48090 |
| Postgres UI (Adminer) | http://localhost:48084 |

---

## Feed v2 Local Verification

Use this after the `serving` profile is up and Redis is running with the Stack image.

### 1. Run the live Redis Stack aggregation test

```bash
cd backend/news-app
./mvnw -Dtest=FeedRepositoryRedisStackIntegrationTest test
```

Expected result:
- the test passes against the local Redis Stack instance
- if Redis is not reachable, the test is skipped by its reachability guard

### 2. Start the news API locally

```bash
cd backend/news-app
./mvnw spring-boot:run
```

The API should be reachable at `http://localhost:8999`.

### 3. Seed a temporary personalized user

```bash
docker exec imperium-redis redis-cli HSET 'user:e2e-v2-user:prefs' topics '["business_economy"]' country_id '7' topic_prefs_version '1'
```

This creates a minimal personalized feed scope on top of existing live feed data.

### 4. Exercise the real feed endpoints

```bash
curl -s 'http://localhost:8999/api/v1/feed?userId=e2e-v2-user&limit=5'
curl -s 'http://localhost:8999/api/v1/feed/topic?userId=e2e-v2-user&topicId=business_economy&limit=5'
curl -s 'http://localhost:8999/api/v1/feed/latest?userId=e2e-v2-user&limit=5'
```

Expected result:
- all three endpoints return `200`
- responses include `sessionId`, `sessionAnchor`, `nextScrollCursor`, `source`, `hasMore`, and `newSinceLastSession`
- `/api/v1/feed` returns `source="primary"` when personalized topic feed data exists

### 5. Verify pagination reuses the same session

Run the first request and capture `sessionId`, then call `/api/v1/feed` again with that `sessionId`.

Expected result:
- the same `sessionId` is reused
- the second page advances `nextScrollCursor`
- served article IDs do not overlap across the two pages

### 6. Clean up temporary keys

```bash
docker exec imperium-redis redis-cli DEL 'user:e2e-v2-user:prefs' 'bf:user:e2e-v2-user:viewed'
docker exec imperium-redis sh -lc "redis-cli --scan --pattern 'session:e2e-v2-user:*' | xargs -r redis-cli DEL"
```

Use a different test user if you want to preserve an earlier session for inspection.

---

## Bringing the Stack Down

### Tear down all profiles at once

```bash
docker-compose \
  --profile source \
  --profile backbone \
  --profile serving \
  --profile processing-infra \
  --profile processing \
  --profile projectors \
  --profile migration \
  --profile ui \
  down
```

> This removes containers and networks but **preserves all named volumes** (Kafka data, Spark checkpoints, Qdrant data, Redis data). Add `-v` only if you want a full clean reset.

### Tear down a single profile

```bash
# Only drivers (no dependencies affected)
docker-compose stop imperium-canonical-enrichment-driver imperium-classification-driver
docker-compose rm -f imperium-canonical-enrichment-driver imperium-classification-driver

# Only UI
docker-compose --profile backbone --profile serving --profile ui down --remove-orphans
```

---

## Restarting a Single Service

```bash
docker-compose --profile <profile> up -d --force-recreate --no-deps <service-name>
```

Example:
```bash
docker-compose --profile backbone --profile serving --profile source --profile processing-infra \
  up -d --force-recreate --no-deps imperium-canonical-enrichment-driver
```

---

## Known Issues

| Issue | Fix |
|---|---|
| Debezium connectors FAILED with `UnknownHostException` | Update `database.hostname` via Kafka Connect REST API (see step 2) |
| `service "X" depends on undefined service "Y"` | Always include all required profiles in the `up` command |
| Spark driver exits with `Permission denied` on `.py` file | Blank line inside `bash -lc '...'` YAML block — the `.py` path was being run as a separate shell command instead of passed to `spark-submit`. Fixed in `compose/spark-drivers.yml`. |
| Qdrant `duplicate field max_segment_size` | Renamed env var to `MAX_SEGMENT_SIZE_KB` then removed it — see Issue 12 in `issues.md` |
| News CDC connector FAILED with `RecordTooLargeException` | Connector config needs `producer.override.max.request.size=10485760` (10 MB, matching broker limit) — see Issue 13 in `issues.md` |
| Postgres projector loops on `Temporary failure in name resolution` | Image is stale (still uses `PHASE3_POSTGRES_DSN`). Rebuild with `--build` — see Issue 14 |
| Clone-news rebuild sends 400 MB of context | Build context now scoped to `infrastructure/docker/clone-news/` — see Issue 15 |

---

## Health Check Summary

```bash
# All containers status
docker-compose --profile source --profile backbone --profile serving --profile processing-infra ps

# Debezium connectors
docker exec imperium-kafka-connect curl -s http://kafka-connect:8083/connectors

# Spark cluster
curl http://localhost:48080/api/v1/applications

# Qdrant
curl http://localhost:46333/healthz

# Redis
docker exec imperium-redis redis-cli ping
```
