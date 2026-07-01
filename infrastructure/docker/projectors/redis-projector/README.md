# Redis Projector

This Docker image runs the Redis projector, which consumes articles from Kafka and projects them into Redis.

## Environment Variables

When deploying to Kubernetes, you need to configure the following environment variables:

| Variable | Description | Example (K8s) |
|---|---|---|
| `KAFKA_BOOTSTRAP_SERVERS` | Comma-separated list of Kafka broker addresses. | `kafka-service:9092` |
| `SCHEMA_REGISTRY_URL` | URL of the Schema Registry service. | `http://schema-registry-service:8081` |
| `REDIS_URL` | Connection URL for Redis. | `redis://redis-service:6379/0` |
| `KAFKA_GROUP_ID` | (Optional) Kafka consumer group ID. | `imperium-redis-projector-group` |

## Build Command
```bash
docker build -f infrastructure/docker/projectors/redis-projector/Dockerfile -t imperium-redis-projector:latest apps/processing/news-pipeline/jobs/projections
```
