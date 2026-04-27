# Phase 3 News Pipeline

This module owns the Python/Spark processing jobs for Phase 3.

The first tracer bullet implements GitHub issue `#14`: convert CDC-like
`table_news` records into a canonical article, upsert the cleaned article into
PostgreSQL, and emit the canonical event with `classification_status=pending`.

The topic taxonomy slice implements the core of GitHub issue `#17`: the
`news_topic_taxonomy_medtop_en_us.json` Medtop seed, deterministic topic
embedding input text from topic name, description, tags, and sub-topics,
embedding input hashing, and active embedding repository contracts for the
classifier.

The dimension materialization slice implements GitHub issue `#15`: Spark reads
dimension CDC topics, projects filtered curated records, handles deletes as
inactive dimensions, resolves country through authority/sedition before falling
back to link country, and lets canonical article processing emit with partial
dimension status when optional dimensions are late.

The Redis feed projection slice implements GitHub issue `#16`: eligible
canonical articles are projected to compact `article:{article_id}` cards plus
global and country sorted-set feeds before classification completes. Redis cards
exclude full body text, and projector failures are captured so Redis outages do
not block independent projectors.

The central embedding gateway slice implements GitHub issue `#18`: Spark jobs
and topic embedding refresh code call an internal gateway abstraction instead of
holding provider credentials in executor code. The gateway owns NVIDIA
`baai/bge-m3` configuration, 8191-item batch limits, global 40 RPM throttling,
retry/backoff behavior for 429 and 5xx provider failures, split-before-final
item failure, and request metrics.

Local operator UIs are available under the `ui` compose profile:

- Kafka UI on `${KAFKA_UI_EXTERNAL_PORT:-48089}`
- RedisInsight on `${REDIS_UI_EXTERNAL_PORT:-48090}`
- Adminer on `${PG_UI_EXTERNAL_PORT:-48084}`

The embedding similarity classification slice implements GitHub issue `#19`:
classify pending canonical articles by embedding the title plus the first 30
cleaned body words through the central gateway, comparing against active leaf
topic embeddings from PostgreSQL, deriving root topic metadata from the
taxonomy, and emitting an updated canonical article with
`classification_status=classified` or `classification_status=failed`.

The Redis root-topic feed slice implements GitHub issue `#20`: once
classification completes, Redis adds `article_id` membership to
`feed:topic:{root_topic_id}` and `feed:country:{country_id}:topic:{root_topic_id}`,
removes old memberships on reclassification, and cleans them up on hide/delete
without ever using leaf-topic feed keys.

Use `#20` for browse surfaces. Topic pages and country+topic pages can read
Redis directly after classification. Reclassification must rerun the same
article ID so old root-topic membership is removed before new membership is
written.

The Qdrant projection slice implements GitHub issue `#21`: classified canonical
articles are projected independently into Qdrant with article embeddings and
filter payload fields for `article_id`, country/root/primary topic IDs,
secondary topic IDs, topic tags, authority/language/rubric IDs, `published_at`,
`is_visible`, and `source_domain`.

Use `#21` for semantic search and vector filtering. Qdrant stores embedding plus
payload filters so later search jobs can ask for topic, country, language, or
visibility constraints without depending on Redis state.

The replay-safe projection state slice implements GitHub issue `#22`: projection
state stores `article_id`, `country_id`, `root_topic_id`, `published_at`,
`is_visible`, and `is_deleted` so fanout can detect duplicate replays, clean old
country/root-topic memberships on updates, and keep hide/delete cleanup safe for
both Redis and Qdrant.

The runtime foundation slice implements GitHub issue `#25`: Phase 3 runtime
configuration loads local Compose defaults, Debezium Avro CDC envelopes decode
into stable table-change records, Kafka topic bootstrap specs define canonical
and DLQ topic behavior, and concrete adapter boundaries exist for PostgreSQL,
Kafka, Redis, Qdrant, and NVIDIA runtime wiring.

The simplified real-processing runtime slice starts GitHub issue `#26`: decoded
Debezium CDC dimension changes are materialized into curated dimension records,
decoded news changes in the 5-day MVP window become enriched canonical
articles, delete events are ignored, empty normalized content is routed to the
DLQ, canonical events are emitted by raw news ID, and Redis writes compact
`article:{article_id}`, `feed:global`, and `feed:country:{country_id}` state
before classification.

## Local Tests

```bash
PYTHONPATH=apps/processing/news-pipeline/src python3 -m unittest discover -s tests/processing -p 'test_*.py'
```

Phase 3 end-to-end smoke report (`#23`) with explicit acceptance checkpoints:

```bash
PYTHONPATH=apps/processing/news-pipeline/src python3 apps/processing/news-pipeline/jobs/phase3_e2e_smoke.py
```

Phase 3 runtime foundation smoke report (`#25`) with offline foundation checks:

```bash
PYTHONPATH=apps/processing/news-pipeline/src python3 apps/processing/news-pipeline/jobs/phase3_runtime_foundation_smoke.py
```

The foundation smoke reports PASS for config loading, CDC fixture decoding,
topic bootstrap specs, and live local PostgreSQL, Kafka, Schema Registry, Redis,
and Qdrant connectivity. It reports WARN for NVIDIA when `NVIDIA_API_KEY` is
not supplied, because the live provider smoke remains
`jobs/nvidia_embedding_smoke.py`.

Phase 3 pending feed smoke report (`#26` first runtime behavior slice):

```bash
PYTHONPATH=apps/processing/news-pipeline/src python3 apps/processing/news-pipeline/jobs/phase3_pending_feed_smoke.py
```

The pending feed smoke decodes CDC fixtures for curated dimensions and one news
event, writes a pending cleaned article, emits the canonical pending event,
projects Redis global/country feed state, checks Redis cards exclude full body
text, and replays the same news event to prove idempotent cleaned/Kafka/Redis
behavior.

## Spark Entrypoint

`jobs/canonical_article_first_emit.py` is the Spark job boundary. It keeps Spark
I/O concerns separate from the core canonical article code in
`imperium_news_pipeline.phase3.canonical`.

Runtime wiring for Kafka and PostgreSQL is intentionally adapter-driven. Core
logic depends on repository, producer, clock, and ID provider abstractions so it
can be tested without external services and replaced at the job boundary.

`imperium_news_pipeline.phase3.postgres.PostgresCleanedArticleRepository`
implements the PostgreSQL cleaned-article upsert behind the repository
abstraction. It accepts a DB-API style connection factory so deployment can
choose the concrete driver without changing core processing.

`imperium_news_pipeline.phase3.topics` owns taxonomy and topic embedding domain
contracts. The seed taxonomy is intentionally small and should be reviewed by a
human before broad use. PostgreSQL stores the durable source of truth in
`imperium_topic_taxonomy` and active topic vectors in
`imperium_topic_embeddings`;
classification loads active embeddings from PostgreSQL instead of Qdrant.

`imperium_news_pipeline.phase3.dimensions` owns curated dimension projection,
dimension enrichment, and optional compacted dimension-event publishing.
`jobs/dimension_materialization.py` is the Spark Structured Streaming boundary;
runtime wiring injects the concrete PostgreSQL repository and optional Kafka
producer.

`imperium_news_pipeline.phase3.redis_projection` owns Redis feed-card and
non-topic feed projection behind a small Redis client abstraction. Topic feed
membership remains a later classification-dependent slice.

`imperium_news_pipeline.phase3.embedding_gateway` owns the central embedding
gateway contracts. `EmbeddingGateway` depends on an `EmbeddingProvider`
abstraction; `NvidiaEmbeddingProvider` is the provider adapter that holds the
API key and translates retryable NVIDIA HTTP responses into gateway retry
signals. Downstream Spark code should depend on the gateway interface and pass
article/topic text only.

`imperium_news_pipeline.phase3.classification` owns embedding-similarity
classification. The classifier depends on the central gateway abstraction,
`TopicEmbeddingRepository`, `TopicTaxonomyService`, and existing cleaned article
repository / producer abstractions so reclassification updates the same
`article_id` state and emits the latest canonical article result.

`imperium_news_pipeline.phase3.redis_projection` also owns root-topic feed
membership updates for classified articles. Reclassification removes prior root
memberships before writing the new root and optional country+root feed keys.

`imperium_news_pipeline.phase3.qdrant_projection` owns vector projection behind
small vector-gateway and Qdrant-client abstractions so Qdrant health remains
independent from Redis projection health. `projection_fanout.py` is a minimal
coordinator that invokes both projectors and preserves failure isolation.

`imperium_news_pipeline.phase3.projection_state` owns replay-safe projection
state contracts behind a repository abstraction. `ProjectionFanout` reads prior
state to remove stale Redis memberships on country/topic updates, skips exact
replays, and only persists new state when both Redis and Qdrant projectors
succeed.

`jobs/nvidia_embedding_smoke.py` is a manual smoke entrypoint for the real
NVIDIA API. It reads the `NVIDIA_*` environment variables, sends two short
texts through the gateway, and prints a compact success summary. It does not
log the API key or persist results.

`imperium_news_pipeline.phase3.runtime_config` centralizes runtime environment
parsing for Kafka, Schema Registry, PostgreSQL, Redis, Qdrant, NVIDIA,
checkpoint roots, source topic prefix, canonical topic names, and the 5-day MVP
window.

`imperium_news_pipeline.phase3.cdc` owns the reusable Debezium Avro CDC decoder
boundary. Spark jobs should deserialize Avro at the job edge, then pass key and
value mappings into `DebeziumAvroCdcDecoder` to get table-change records with
operation, key, before/after payloads, source table, and event timestamp.

`imperium_news_pipeline.phase3.runtime_adapters` owns the first concrete local
adapter wrappers for PostgreSQL repositories, canonical Kafka event IO, Redis
commands, and Qdrant collection/point writes. These adapters keep live clients
at the runtime edge while preserving the existing testable repository and
projector abstractions.

`imperium_news_pipeline.phase3.topic_bootstrap` defines the local runtime Kafka
topic specs. `imperium.canonical-articles` is compacted with bounded retention;
`imperium.canonical-articles.dlq` is delete-retained for runtime failures. The
foundation smoke validates the spec shape; later runtime jobs should use the
admin adapter against the live Kafka cluster before consuming or producing.

`imperium_news_pipeline.phase3.pending_feed_runtime` owns the first `#26`
runtime behavior. It maps Phase 2 source tables (`table_links`,
`table_authority`, `table_sedition`, `table_pays`, `table_rubrique`,
`table_langue`, and `table_news`) from decoded CDC envelopes into the existing
dimension, canonical article, producer, and Redis projector contracts. It keeps
the 5-day MVP window and replay/idempotency behavior testable before the Spark
job entrypoints are fully wired to live Avro deserialization and concrete
clients.

## Spark Submit Model

Each long-running Phase 3 Spark job should be submitted from its own driver
container instead of reusing `spark-master` as the driver for every job.

Default model:
- `spark-master` only coordinates the cluster.
- `spark-worker` containers execute tasks.
- one dedicated driver container submits and owns one long-running job.
- each job uses a separate checkpoint location.
- each job has its own env, logs, restart policy, and failure boundary.

This keeps the canonical article job, dimension materialization job,
classification job, Redis projector job, and Qdrant projector job isolated from
each other while still sharing the same Spark cluster.

Example submit shape from a dedicated driver container:

```bash
/opt/spark/bin/spark-submit \
  --master spark://spark-master:7077 \
  --deploy-mode client \
  --conf spark.driverEnv.PYTHONPATH=/opt/imperium/news-pipeline/src \
  --conf spark.executorEnv.PYTHONPATH=/opt/imperium/news-pipeline/src \
  /opt/imperium/news-pipeline/jobs/canonical_article_first_emit.py
```

Dimension materializer submit shape:

```bash
/opt/spark/bin/spark-submit \
  --master spark://spark-master:7077 \
  --deploy-mode client \
  --conf spark.driverEnv.PYTHONPATH=/opt/imperium/news-pipeline/src \
  --conf spark.executorEnv.PYTHONPATH=/opt/imperium/news-pipeline/src \
  /opt/imperium/news-pipeline/jobs/dimension_materialization.py
```

Do not reuse the same checkpoint directory across jobs. A checkpoint path is
part of the streaming job identity and must remain stable for that specific job
only.

## Compose Driver Runtime

The local runtime now has one dedicated driver container per Phase 3 job:

- `imperium-topic-embedding-driver`
- `imperium-dimension-driver`
- `imperium-canonical-driver`
- `imperium-classification-driver`
- `imperium-redis-driver`
- `imperium-redis-topics-driver`
- `imperium-qdrant-driver`
- `spark-history-server`
- `spark-worker-1`
- `spark-worker-2`
- `spark-worker-3`

Runtime cadence:
- dimension materializer runs as fast as it can with three independent query
  groups: reference dimensions, authority, and links
- links and authority use separate checkpoints and offset windows so the two
  million-row topics progress independently
- dimension rows are decoded on Spark executor partitions and written to
  PostgreSQL with bounded batch upserts; the driver only receives partition
  counts
- canonical news processing uses a 5 second processing-time trigger
- classification, both Redis jobs, and Qdrant projection use 15 second processing-time triggers
- this keeps dimensions ahead of news without depending on source-order luck

Bring up the full real runtime with:

```bash
SPARK_HISTORY_UI_EXTERNAL_PORT=48182 \
docker-compose --env-file .env \
  --profile backbone \
  --profile source \
  --profile serving \
  --profile processing \
  up -d \
  spark-history-server \
  imperium-topic-embedding-driver \
  imperium-dimension-driver \
  imperium-canonical-driver \
  imperium-classification-driver \
  imperium-redis-driver \
  imperium-redis-topics-driver \
  imperium-qdrant-driver
```

Notes:

- Each processing driver keeps its own checkpoint under
  `/tmp/imperium/checkpoints/processing`.
- The dimension driver keeps its preserved checkpoint state under
  `/tmp/imperium/checkpoints/dimensions`.
- Spark event logs are written to the shared `spark-events` volume.
- Spark History Server reads those logs and exposes the UI on the configured
  host port.
- The driver containers run `spark-submit` directly rather than requiring
  interactive execution inside `spark-master`.
- The Spark cluster now runs with 3 workers so the long-lived jobs do not fight
  over a single worker.
