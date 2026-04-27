# Imperium Local Stack URLs

Use these local URLs for the running Phase 3 and UI stack.

## Core Stack

- Kafka broker 1: `localhost:49092`
- Kafka broker 2: `localhost:49093`
- Kafka Connect: `http://localhost:48083`
- Schema Registry: `http://localhost:48081`
- PostgreSQL source: `localhost:35432`
- Redis: `localhost:46379`
- Qdrant HTTP: `http://localhost:46333`
- Qdrant gRPC: `localhost:46334`

## Spark

- Spark Master UI: `http://localhost:48080`
- Spark Master cluster port: `spark://localhost:47077`
- Spark Worker 1 UI: `http://localhost:48091`
- Spark Worker 2 UI: `http://localhost:48092`
- Spark Worker 3 UI: `http://localhost:48093`
- Spark History Server: `http://localhost:48082`

Use these first during replay:

- Cluster scheduling and executor pressure: Spark Master UI
- Completed and running application history: Spark History Server
- Per-job Spark UI while the driver is up: the driver URLs below

## Phase 3 Drivers

- Canonical driver: `imperium-canonical-driver`
- Classification driver: `imperium-classification-driver`
- Dimension driver: `imperium-dimension-driver`
- Redis cards/global-country driver: `imperium-redis-driver`
- Redis topics driver: `imperium-redis-topics-driver`
- Qdrant projector driver: `imperium-qdrant-driver`
- Topic embedding driver: `imperium-topic-embedding-driver`

## Driver Debug Endpoints

- Canonical Spark UI: `http://localhost:48100`
- Canonical driver RPC: `localhost:47100`
- Canonical block manager: `localhost:47200`
- Classification Spark UI: `http://localhost:48101`
- Classification driver RPC: `localhost:47101`
- Classification block manager: `localhost:47201`
- Redis cards/global-country Spark UI: `http://localhost:48102`
- Redis cards/global-country driver RPC: `localhost:47102`
- Redis cards/global-country block manager: `localhost:47202`
- Redis topics/projection-state Spark UI: `http://localhost:48103`
- Redis topics/projection-state driver RPC: `localhost:47103`
- Redis topics/projection-state block manager: `localhost:47203`
- Qdrant Spark UI: `http://localhost:48104`
- Qdrant driver RPC: `localhost:47104`
- Qdrant block manager: `localhost:47204`

Replay progress is easiest to read from:

- canonical growth: PostgreSQL `imperium_articles` plus `imperium.canonical-articles`
- classification growth: PostgreSQL rows where `classification_status='classified'`
- Redis growth: `article:*` and `feed:*`
- projection-state growth: PostgreSQL `imperium_projection_state`
- Qdrant growth: `imperium_articles` `points_count`

## Operator UIs

- Kafka UI: `http://localhost:48089`
- Redis UI: `http://localhost:48090`
- PostgreSQL UI: `http://localhost:48084`

## Notes

- Kafka UI is visible in the container list before its health check flips green
  during startup.
- Redis UI uses RedisInsight.
- PostgreSQL UI uses Adminer and connects to `postgres-source`.
