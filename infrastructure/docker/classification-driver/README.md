# Classification Spark Driver

This image bundles the PySpark code necessary to run the **Classification Driver** (`jobs/phase3_classification_runtime.py`) in a Kubernetes environment.

This driver acts as a Spark Structured Streaming application that consumes enriched canonical news events from Kafka, classifies them based on topic taxonomy and vector embeddings (using a remote Nvidia embedding gateway), and updates the metadata (primary topic, candidates, confidence) before producing them back to Kafka (or DLQ if classification fails).

## Build Instructions

Because this Dockerfile relies on `imperium-spark:3.5.3` and references codebase directories relative to the root of the repository, you should run the `docker build` command from the root of the `apps/processing/news-pipeline` directory:

```bash
cd /path/to/imperium-news-streaming-platform/apps/processing/news-pipeline
docker build -t your-registry/imperium-classification-driver:latest -f ../../../infrastructure/docker/classification-driver/Dockerfile .
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
  /opt/imperium/news-pipeline/jobs/phase3_classification_runtime.py
```

## Environment Variables

The driver is highly configurable and relies on environment variables (read via `Phase3RuntimeConfig` and job prefix mappings) to locate services. In Kubernetes, you should provide these through a `ConfigMap` or `Secret`.

### Required Variables
*   `KAFKA_BOOTSTRAP_SERVERS` (e.g. `kafka-cluster.namespace.svc.cluster.local:9092`)
*   `SCHEMA_REGISTRY_URL` (e.g. `http://schema-registry.namespace.svc.cluster.local:8081`)
*   `POSTGRES_DSN` (e.g. `postgresql://user:pass@news-source-db.namespace.svc.cluster.local:5432/imperium-news-source`)
*   `NVIDIA_EMBEDDING_BASE_URL` (e.g. `http://llama-cpp.namespace.svc.cluster.local:8080/v1`)
*   `NVIDIA_API_KEY` (if authentication is required by your embedding gateway model)

### Optional / Configuration Variables
*   `CHECKPOINT_ROOT`: The directory where Spark writes its checkpoint files. **Crucial for K8s:** This must be a persistent shared path (like `s3a://your-bucket/checkpoints` or a mounted PersistentVolumeClaim) to ensure state survives pod restarts. Default is `/tmp/imperium/checkpoints/processing`.
*   `CLASSIFICATION_STARTING_OFFSETS`: Defines where Kafka starts reading (default `latest`).
*   `CLASSIFICATION_KAFKA_GROUP_ID`: Kafka group ID for consumer tracking (default `imperium-classification-driver-latest-v1`).
*   `CLASSIFICATION_MAX_OFFSETS_PER_TRIGGER`: Throttles the amount of offsets processed per trigger (default `10000`).
*   `CLASSIFICATION_TRIGGER_PROCESSING_TIME`: Trigger frequency (default `10 seconds`).
*   `CLASSIFICATION_MAX_ARTICLES_PER_BATCH`: Maximum number of articles to classify per batch to prevent gateway rate-limits (default `700`).
*   `CLASSIFICATION_EMBEDDING_BATCH_SIZE`: Batch size for querying the embedding service (default `100`).
*   `CLASSIFICATION_NVIDIA_RPM_BUDGET`: Rate limits (Requests Per Minute) sent to the NVIDIA API (default `24`).
*   `CLASSIFICATION_CHECKPOINT_NAME`: Name used in the checkpoint path sub-directory (default `classification-latest-v1`).
*   `ARTICLE_TABLE`: Table name in PostgreSQL containing articles (default `imperium_articles`).
*   `TOPIC_TAXONOMY_TABLE`: Table name containing taxonomy definitions (default `imperium_topic_taxonomy`).
*   `TOPIC_EMBEDDINGS_TABLE`: Table name containing pre-computed topic embeddings (default `imperium_topic_embeddings`).
*   `CLASSIFIED_DLQ_TOPIC`: Topic used to route failed classification events (default `imperium.news.classified.dlq`).
