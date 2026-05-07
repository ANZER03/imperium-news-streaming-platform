# Scripts Runbook

All scripts are grouped by domain. Each domain folder is self-contained and sources its helpers from `scripts/lib/`.

## Directory layout

```
scripts/
  lib/
    env.sh            — load .env file into the shell environment
    cdc.sh            — shared helpers for CDC scripts (connect_request, wait_for_connector)
    processing.sh     — shared helpers for processing scripts (compose, pg_exec, kafka_exec, redis_exec, qdrant_request)

  cdc/
    up.sh             — register / start all Debezium source connectors
    down.sh           — pause connectors without touching topics or replication slots
    clean.sh          — delete connectors, topics, consumer groups, and replication slots
    verify.sh         — assert connector status, slot lag, and topic existence
    validate.sh       — deeper validation: row counts, schema subjects, consumer group offsets

  processing/
    up.sh             — start all processing services (enrichment, classification, projectors)
    down.sh           — stop and remove processing containers
    clean.sh          — reset processing state (default: truncate tables, flush Redis/Qdrant/checkpoints; --full: also drop dimension/taxonomy tables)
    fresh-reset.sh    — full 11-step reset from offset 0 (stop → wipe → recreate topics → seed → start)
    logs.sh           — follow logs for all processing services
    validate.sh       — check article counts, Kafka topics, Redis keys, Qdrant collections
    migrate.sql       — DDL for all processing tables (idempotent)

  source-db/
    init.sh           — start news-source-db container and apply all initdb SQL files
    refresh.sh        — drop and recreate WAL publications and Debezium signal table (preserves data)
    temp-sink-setup.sh — manage the temporary PostgreSQL sink used for connector testing
                        Usage: temp-sink-setup.sh [--setup | --register]

  clone/
    clone-news.py     — clone a slice of table_news from prod by ID range
    scheduler.py      — long-running scheduler that clones 2 000 rows every 5 minutes
    bulk.py           — one-shot bulk clone of 100k rows
    clone_table.py    — low-level clone engine (used by the scripts above)
    clone_table_*.py  — per-table entry points (pays, langue, rubrique, sedition, authority, links, news)
    lib/
      postgres_clone_common.py — CloneContext class and config helpers
    requirements.txt  — psycopg[binary]>=3.2.3

  seed/
    seed-redis.py     — seed Redis with test user preferences and article feeds
    import-csv.py     — import a table_news CSV export directly into the local source DB
    requirements.txt  — redis>=5.1.1, psycopg[binary]>=3.2.3
```

---

## Prerequisites

1. Copy `.env.prod.example` → `.env.prod` and fill in production DB credentials (required for clone scripts).
2. Ensure `docker-compose` (or `docker compose`) is available.
3. For Python scripts, install dependencies:
   ```bash
   pip install -r scripts/clone/requirements.txt
   pip install -r scripts/seed/requirements.txt
   ```

---

## Common workflows

### First-time source DB setup

```bash
make source-db-init    # start news-source-db and apply schema
make cdc-up            # register Debezium connectors
make cdc-verify        # assert connectors are RUNNING
```

### Refresh WAL publications (after schema changes)

```bash
make source-db-refresh
make cdc-reset-and-verify   # refresh + clean + up + verify in one step
```

### Start the processing pipeline

```bash
make processing-up          # start enrichment, classification, projectors
make processing-logs        # follow all processing logs
make processing-validate    # check article counts, Kafka topics, Redis keys, Qdrant
```

### Full reset (wipe everything and start from offset 0)

```bash
make processing-fresh-reset
```

### Partial reset (preserve dimensions and taxonomy)

```bash
make processing-clean       # truncate articles, flush Redis/Qdrant, delete topics
make processing-up
```

### Full reset including dimension tables

```bash
make processing-clean-full
```

### Clone table_news from production

```bash
# One-off slice: rows with id > 565731322, fetch 5000 rows
make clone-news ARGS="--from-id 565731322 --size 5000"

# Continuous scheduler (runs in foreground, 2000 rows every 5 min)
make clone-schedule

# Bulk 100k clone
make clone-bulk ARGS="--start-id 565170965 --limit 100000"
```

### Clone reference/metadata tables from production

```bash
python3 scripts/clone/clone_table_pays.py
python3 scripts/clone/clone_table_langue.py
python3 scripts/clone/clone_table_rubrique.py
python3 scripts/clone/clone_table_sedition.py
python3 scripts/clone/clone_table_authority.py
python3 scripts/clone/clone_table_links.py
```

### Import a CSV into the local source DB

```bash
make seed-import-csv ARGS="--csv scripts/clone/exports/table_news.tail.csv"
```

### Seed Redis with test data

```bash
make seed-redis
```

### Temp sink for connector testing

```bash
make source-db-temp-sink                          # start container + register connectors
bash scripts/source-db/temp-sink-setup.sh --setup     # container only
bash scripts/source-db/temp-sink-setup.sh --register  # connectors only
```

### Pause CDC without losing offsets

```bash
make cdc-down     # pause connectors (keeps topics and replication slots)
make cdc-up       # resume
```

---

## Environment variables

All scripts read from `.env` (via `scripts/lib/env.sh`) and respect overrides from the shell environment. Key variables:

| Variable | Default | Used by |
|---|---|---|
| `SOURCE_PG_HOST` | `news-source-db` | processing lib |
| `SOURCE_PG_PORT` | `5432` | processing lib |
| `SOURCE_PG_DATABASE` | `imperium-news-source` | processing lib, source-db scripts |
| `SOURCE_PG_USER` | `postgres` | processing lib, source-db scripts |
| `KAFKA_BOOTSTRAP` | `localhost:49092` | processing lib |
| `QDRANT_URL` | `http://localhost:46333` | processing lib |
| `CONNECT_URL` | `http://localhost:48083` | cdc lib |
| `PROD_PGHOST` | _(required for clone)_ | clone lib |
| `PROD_PGPORT` | `5432` | clone lib |
| `PROD_PGDATABASE` | _(required for clone)_ | clone lib |
| `PROD_PGUSER` | _(required for clone)_ | clone lib |
| `PROD_PGPASSWORD` | _(required for clone)_ | clone lib |
| `REDIS_HOST` | `localhost` | seed-redis.py |
| `REDIS_PORT` | `46379` | seed-redis.py |
| `CLONE_BATCH_SIZE` | `2000` | scheduler.py |
| `CLONE_INTERVAL` | `300` | scheduler.py |
