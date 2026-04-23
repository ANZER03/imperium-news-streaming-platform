# imperium-news-streaming-platform

## Phase 1 infrastructure foundation

This repository is being built incrementally around a local, production-shaped
streaming platform foundation.

Current scope:
- root-level Compose entrypoint
- committed `.env.example` + ignored local `.env`
- shared network/volume conventions
- salted high-port host mapping conventions
- healthcheck/dependency conventions for upcoming services
- Kafka + Karapace backbone profile
- Debezium Connect + Spark processing profile

The actual Phase 1 services are added slice-by-slice in follow-up issues.

## Quick start

```bash
cp .env.example .env
make infra-config
make foundation-up
```

Start the Kafka + Karapace backbone:

```bash
cp .env.example .env
docker-compose --env-file .env --profile backbone up -d
```

Start the processing substrate after the backbone is up:

```bash
docker-compose --env-file .env --profile backbone --profile processing up -d
```

Inspect foundation logs:

```bash
make foundation-logs
```

Stop the foundation profile:

```bash
make foundation-down
```

If you prefer not to create `.env` yet, you can validate the stack shape directly:

```bash
make infra-config ENV_FILE=.env.example
```

## Notes

- Service-specific assets live under `infrastructure/`.
- Host ports use a high prefixed pattern to reduce conflicts.
- The `backbone` profile currently starts Kafka broker 1, Kafka broker 2, and Karapace.
- The `processing` profile currently starts Debezium Connect, Spark master, and one Spark worker.
- Phase 1 currently excludes source PostgreSQL, connector configs, topic
  bootstrap, and schema bootstrap.
