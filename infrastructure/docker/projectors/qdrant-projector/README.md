# Qdrant Projector

This Docker image runs the Qdrant projector, which consumes articles from Kafka and projects them (with vectors) into Qdrant.

## Environment Variables

When deploying to Kubernetes, you need to configure the following environment variables:

| Variable | Description | Example (K8s) |
|---|---|---|
| `KAFKA_BOOTSTRAP_SERVERS` | Comma-separated list of Kafka broker addresses. | `kafka-service:9092` |
| `SCHEMA_REGISTRY_URL` | URL of the Schema Registry service. | `http://schema-registry-service:8081` |
| `QDRANT_URL` | URL of the Qdrant vector database. | `http://qdrant-service:6333` |
| `QDRANT_COLLECTION` | Qdrant collection name. | `imperium_articles` |

## Build Command
```bash
docker build -f infrastructure/docker/projectors/qdrant-projector/Dockerfile -t imperium-qdrant-projector:latest apps/processing/news-pipeline/jobs/projections
```
