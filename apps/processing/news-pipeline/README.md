# Phase 3 News Pipeline

This module owns the Python/Spark processing jobs for Phase 3.

The first tracer bullet implements GitHub issue `#14`: convert CDC-like
`table_news` records into a canonical article, upsert the cleaned article into
PostgreSQL, and emit the canonical event with `classification_status=pending`.

The topic taxonomy slice implements the core of GitHub issue `#17`: hierarchical
root and primary topics, multilingual topic metadata, deterministic topic
embedding input text, embedding input hashing, and active embedding repository
contracts for the classifier.

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
`baai/bge-m3` configuration, 8192-item batch limits, global 40 RPM throttling,
retry/backoff behavior for 429 and 5xx provider failures, split-before-final
item failure, and request metrics.

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

The Qdrant projection slice implements GitHub issue `#21`: classified canonical
articles are projected independently into Qdrant with article embeddings and
filter payload fields for `article_id`, country/root/primary topic IDs,
secondary topic IDs, topic tags, authority/language/rubric IDs, `published_at`,
`is_visible`, and `source_domain`.

## Local Tests

```bash
PYTHONPATH=apps/processing/news-pipeline/src python3 -m unittest discover -s tests/processing -p 'test_*.py'
```

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
`phase3_topic_taxonomy` and active topic vectors in `phase3_topic_embeddings`;
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

`jobs/nvidia_embedding_smoke.py` is a manual smoke entrypoint for the real
NVIDIA API. It reads the `NVIDIA_*` environment variables, sends two short
texts through the gateway, and prints a compact success summary. It does not
log the API key or persist results.

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
