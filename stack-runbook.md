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
| `ui` | `kafka-ui`, `redis-ui`, `pg-ui` | `backbone`, `serving` already running |
| `migration` | `clone-news` | `source` already running |

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

### 6. UI (optional)

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

## Bringing the Stack Down

### Tear down all profiles at once

```bash
docker-compose --profile source --profile backbone --profile serving --profile processing-infra --profile ui down
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
