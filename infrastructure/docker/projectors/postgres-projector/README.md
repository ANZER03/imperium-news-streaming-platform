# Postgres Projector

This Docker image runs the Postgres projector, which consumes articles from Kafka and projects them into a PostgreSQL database.

## Environment Variables

When deploying to Kubernetes, you need to configure the following environment variables:

| Variable | Description | Example (K8s) |
|---|---|---|
| `KAFKA_BOOTSTRAP_SERVERS` | Comma-separated list of Kafka broker addresses. | `kafka-service:9092` |
| `SCHEMA_REGISTRY_URL` | URL of the Schema Registry service. | `http://schema-registry-service:8081` |
| `POSTGRES_DSN` | Connection DSN string for PostgreSQL. | `postgresql://user:pass@postgres-service:5432/imperium` |

## Build Command
```bash
docker build -f infrastructure/docker/projectors/postgres-projector/Dockerfile -t imperium-postgres-projector:latest apps/processing/news-pipeline/jobs/projections
```
