# Infrastructure layout

This directory contains service-specific assets for the Phase 1 stack.

- `docker/` for custom image definitions
- `kafka/` for broker-related assets
- `debezium/` for Kafka Connect / Debezium assets
- `redis/` for Redis-specific assets
- `qdrant/` for Qdrant-specific assets
- `postgres/` reserved for a later phase when the external source database is integrated

Phase 1 intentionally starts with the infrastructure foundation only. Backbone,
processing, serving, and smoke-test slices are added incrementally in later
issues.
