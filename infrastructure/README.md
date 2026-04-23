# Infrastructure layout

This directory contains service-specific assets for the Phase 1 stack.

- `docker/` for custom image definitions
- `kafka/` for broker-related assets
- `debezium/` for Kafka Connect / Debezium assets
- `redis/` for Redis-specific assets
- `qdrant/` for Qdrant-specific assets
- `postgres/` for source PostgreSQL init scripts and local database assets

Phase 1 intentionally starts with the infrastructure foundation only. Backbone,
processing, serving, source-db, and smoke-test slices are added incrementally in
later issues.

Phase 2 CDC planning and rollout notes live under `docs/product/` and
`docs/operations/`.
