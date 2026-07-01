# Elasticsearch Projector

This Docker image runs the Elasticsearch projector, which consumes articles from Kafka and indexes them into Elasticsearch.

## Environment Variables

When deploying to Kubernetes, you need to configure the following environment variables:

| Variable | Description | Example (K8s) |
|---|---|---|
| `KAFKA_BOOTSTRAP_SERVERS` | Comma-separated list of Kafka broker addresses. | `kafka-service:9092` |
| `SCHEMA_REGISTRY_URL` | URL of the Schema Registry service. | `http://schema-registry-service:8081` |
| `CANONICAL_TOPIC` | Kafka topic name to consume from. | `imperium.canonical-articles` |
| `ELASTICSEARCH_URL` | URL of the Elasticsearch instance. | `http://elasticsearch-service:9200` |
| `ELASTICSEARCH_INDEX` | Index name in Elasticsearch. | `imperium_articles_search` |
| `ELASTICSEARCH_BATCH_SIZE` | (Optional) Batch size for indexing. | `5000` |
| `ELASTICSEARCH_TIMEOUT_SECONDS` | (Optional) Timeout for Elasticsearch requests. | `60` |
| `KAFKA_GROUP_ID` | (Optional) Kafka consumer group ID. | `imperium-elasticsearch-projector-canonical-group` |

## Build Command
```bash
docker build -f infrastructure/docker/projectors/elasticsearch-projector/Dockerfile -t imperium-elasticsearch-projector:latest apps/processing/news-pipeline/jobs/projections
```
