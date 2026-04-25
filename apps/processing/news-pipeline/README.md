# Phase 3 News Pipeline

This module owns the Python/Spark processing jobs for Phase 3.

The first tracer bullet implements GitHub issue `#14`: convert CDC-like
`table_news` records into a canonical article, upsert the cleaned article into
PostgreSQL, and emit the canonical event with `classification_status=pending`.

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

Do not reuse the same checkpoint directory across jobs. A checkpoint path is
part of the streaming job identity and must remain stable for that specific job
only.
