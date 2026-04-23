# Phase 2 CDC decision note

## Scope

Phase 2 establishes the first production-safe CDC rollout from PostgreSQL into
Kafka and Karapace.

In scope:
- source CDC readiness validation
- manual publication and replication-slot policy
- reference-data CDC
- mutable metadata CDC
- dedicated news CDC with bounded recent backfill

Out of scope:
- sink connector registration
- Spark processing implementation
- feed serving
- recommendation or ranking logic

## Connector policy

- Reference tables are captured once and stop after snapshot completion.
- Mutable operational metadata continues streaming after incremental snapshot.
- News uses a dedicated connector and does not backfill all history.
- Publications are created manually outside connector startup.
- One replication slot is reserved per connector.
- Source validation must not require writes to production PostgreSQL.
- Connector re-registration is blocked when retained Kafka signal records exist.
- Incremental snapshot signals must use generated unique IDs and explicit topic reset hygiene.

## Documentation pointers

- Readiness workflow: [`../operations/source-cdc-readiness-runbook.md`](../operations/source-cdc-readiness-runbook.md)
- Issue group: [Phase 2 parent issue #8](https://github.com/ANZER03/imperium-news-streaming-platform/issues/8)

## Reference CDC assets

- Connector manifest and registration script:
  `apps/ingestion/connector-bootstrap/reference/`
- Topic bootstrap script: `apps/ingestion/topic-bootstrap/reference/`
- Asset validation: `scripts/validate-reference-cdc-assets.sh`

## Metadata CDC assets

- Connector manifest and registration script:
  `apps/ingestion/connector-bootstrap/metadata/`
- Topic bootstrap script: `apps/ingestion/topic-bootstrap/metadata/`
- Metadata signal emitter: `apps/ingestion/connector-bootstrap/metadata/emit-full-backfill-signal.sh`
- Sink templates: `apps/ingestion/sink-templates/metadata/`
- Asset validation: `scripts/validate-metadata-cdc-assets.sh`

## News CDC assets

- Connector manifest and registration script:
  `apps/ingestion/connector-bootstrap/news/`
- Topic bootstrap script: `apps/ingestion/topic-bootstrap/news/`
- Signal payload template: `apps/ingestion/connector-bootstrap/news/recent-backfill-signal.json`
- Signal topic reset script: `apps/ingestion/topic-bootstrap/news/reset-news-signal-topic.sh`
- Asset validation: `scripts/validate-news-cdc-assets.sh`
