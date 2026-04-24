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
- Kafka + Schema Registry backbone profile
- Debezium Connect + Spark processing profile
- Redis + Qdrant serving profile
- Optional Kafka UI profile

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

Start the serving substrate:

```bash
docker-compose --env-file .env --profile serving up -d
```

Start the optional Kafka UI after backbone + processing are up:

```bash
docker-compose --env-file .env --profile backbone --profile processing --profile ui up -d kafka-ui
```

Run the Phase 1 smoke test after core profiles are up:

```bash
make smoke-test
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
- The `backbone` profile currently starts Kafka broker 1, Kafka broker 2, and Schema Registry.
- The `processing` profile currently starts Debezium Connect, Spark master, and one Spark worker.
- The `serving` profile currently starts Redis and Qdrant.
- The `source` profile currently starts the local PostgreSQL source copy.
- The `ui` profile currently starts Kafka UI as an optional inspection tool.
- Phase 1 currently excludes source PostgreSQL, connector configs, topic
  bootstrap, and schema bootstrap.
- Phase 2 planning lives in `docs/product/phase-2-cdc-decision.md`.
- The source CDC readiness runbook lives in
  `docs/operations/source-cdc-readiness-runbook.md`.
- The mutable CDC signal guide lives in
  `docs/operations/cdc-signal-operations-guide.md`.
- Mutable CDC signal hygiene is enforced by the connector bootstrap scripts and
  documented in `docs/operations/phase-2-cdc-verification-report.md`.

## Validation workflow

1. Copy `.env.example` to `.env`
2. Start the core profiles you want to validate:
   - `backbone`
   - `processing`
   - `serving`
   - `source`
3. Run `make smoke-test`
4. Treat optional UI failures as non-blocking for Phase 1 acceptance

## Phase 2 CDC planning

Phase 2 is scoped to source CDC readiness, reference CDC, metadata CDC, and
news CDC rollout work. Start with the readiness runbook before any connector
registration:

- `docs/product/phase-2-cdc-decision.md`
- `docs/operations/source-cdc-readiness-runbook.md`
- `docs/operations/cdc-signal-operations-guide.md`
