# Canonical Enrichment Spark Driver

This image bundles the PySpark code necessary to run the **Canonical Enrichment Driver** (`jobs/enrichment/driver.py`) in a Kubernetes environment. 

This driver acts as a Spark Structured Streaming application that consumes raw news CDC events from Kafka, performs complex micro-batch joins against the PostgreSQL dimension tables (using both pre-cached and dynamic fetching strategies), and outputs enriched `CanonicalArticle` events back into Kafka (or a Dead Letter Queue for failed enrichments).

## Build Instructions

Because this Dockerfile relies on `imperium-spark:3.5.3` and references codebase directories relative to the root of the repository, you should run the `docker build` command from the root of the `imperium-news-streaming-platform` project:

```bash
cd /path/to/imperium-news-streaming-platform
docker build -t your-registry/imperium-canonical-enrichment-driver:latest -f infrastructure/docker/canonical-enrichment-driver/Dockerfile .
```

## Running the Driver

The driver expects to be launched via `spark-submit`. In Kubernetes, this is typically handled by the `spark-on-k8s-operator` or by supplying the command directly in a Pod definition:

```bash
/opt/spark/bin/spark-submit \
  --master k8s://https://<k8s-api-server> \
  --conf spark.executor.cores=1 \
  --conf spark.cores.max=2 \
  --conf spark.executor.memory=1g \
  --conf spark.driver.memory=1g \
  /opt/imperium/news-pipeline/jobs/enrichment/driver.py
```

## Environment Variables

The driver is highly configurable and relies on environment variables (read via `Phase3RuntimeConfig`) to locate services. In Kubernetes, you should provide these through a `ConfigMap` or `Secret`.

### Required Variables
*   `KAFKA_BOOTSTRAP_SERVERS` (e.g. `kafka-cluster.namespace.svc.cluster.local:9092`)
*   `SCHEMA_REGISTRY_URL` (e.g. `http://schema-registry.namespace.svc.cluster.local:8081`)
*   `POSTGRES_DSN` (e.g. `postgresql://user:pass@news-source-db.namespace.svc.cluster.local:5432/imperium-news-source`)

### Optional / Spark Checkpoint Variables
*   `CHECKPOINT_ROOT`: The directory where Spark writes its checkpoint files. **Crucial for K8s:** This must be a persistent shared path (like `s3a://your-bucket/checkpoints` or a mounted PersistentVolumeClaim) to ensure state survives pod restarts. Default is `/tmp/imperium/checkpoints/processing`.
*   `CANONICAL_STARTING_OFFSETS`: Defines where Kafka starts reading (default `earliest`).
*   `CANONICAL_MAX_OFFSETS_PER_TRIGGER`: Throttles the amount of events processed per batch to prevent OOM errors (e.g. `30000`).
*   `CANONICAL_TRIGGER_PROCESSING_TIME`: Trigger frequency (e.g. `3 seconds`).
*   `DIMENSION_TABLE_PREFIX`: Table prefix for PostgreSQL dimensions (default `imperium_dim_`).

*(Note: While `REDIS_URL` and `QDRANT_URL` exist in the broader config object, this specific enrichment driver focuses primarily on Postgres and Kafka).*
