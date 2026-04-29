# Full CDC Rebootstrap Runbook

## Purpose

Reset the local project back to source-of-truth only, then rebuild CDC from
zero until Kafka matches the source `public.table_*` tables 1:1.

This workflow preserves only source rows in `public.table_*`. It deletes and
recreates the CDC and processing state that can replay stale commands or
duplicate historical data.

Important:
- this workflow now treats `table_news` as full 1:1 ingestion
- it is destructive for local CDC, processing, Redis, Qdrant, and processing
  PostgreSQL state
- it stops once CDC ingestion is healthy and verified; processing replay is a
  later step

## Main commands

Use these `Makefile` targets:

- `make source-db-refresh`
- `make cdc-clean`
- `make cdc-up`
- `make cdc-verify`
- `make cdc-reset-and-verify`
- `make processing-clean-full`
- `make clean-all-from-source`

The main operator command is:

```bash
make clean-all-from-source
```

## Exact order

`make clean-all-from-source` runs:

1. `make processing-clean-full`
2. `make source-db-refresh`
3. `make cdc-clean`
4. `make cdc-up`
5. `make cdc-verify`

If you only need the ingestion layer, use:

```bash
make cdc-reset-and-verify
```

## What is preserved

- source PostgreSQL rows in `public.table_*`

## What is deleted and recreated

- Kafka Connect CDC connectors:
  - `imperium-reference-cdc`
  - `imperium-metadata-cdc`
  - `imperium-news-cdc`
- CDC Kafka topics under:
  - `imperium.reference.*`
  - `imperium.metadata.*`
  - `imperium.news.*`
- Kafka signal topics:
  - `imperium.metadata.signals`
  - `imperium.news.signals`
- `public.debezium_signal` CDC topics
- schema-history topics
- Debezium heartbeat topics
- replication slots:
  - `imperium_reference_slot`
  - `imperium_metadata_slot`
  - `imperium_news_slot`
- `public.debezium_signal`
- source publications:
  - `imperium_reference_publication`
  - `imperium_metadata_publication`
  - `imperium_news_publication`
- processing PostgreSQL tables:
  - `imperium_dim_*`
  - `imperium_articles`
  - `imperium_projection_state`
  - legacy `phase3_*` equivalents
- processing canonical and DLQ topics
- processing checkpoints
- processing consumer groups
- Redis serving keys
- Qdrant serving collection state

## Duplication guards

This workflow encodes the duplication risks directly:

- retained Kafka signal topics are treated as hard blockers for mutable
  connector recreation
- old schema-history topics are deleted during a full CDC clean
- lingering replication slots are deleted during a full CDC clean
- old processing checkpoints and consumer groups are deleted during full
  processing clean
- mutable connectors are re-registered only after signal topics are confirmed
  empty
- exactly one fresh signal is emitted per mutable connector
- signal-topic offsets are recorded before and after the fresh emit in
  `.state/cdc/last-run.env`

Reference parity is explicitly checked because prior live duplication already
showed this shape:

- `table_rubrique`: `39,300` vs topic `78,600`
- `table_sedition`: `30,601` vs topic `61,202`
- `table_pays`: `260` vs topic `520`
- `table_langue`: `186` vs topic `372`

## Acceptance checks

`make cdc-verify` must pass all of these:

- all three connectors are registered and `RUNNING`
- Kafka end offsets match source table counts exactly for:
  - `table_pays`
  - `table_langue`
  - `table_rubrique`
  - `table_sedition`
  - `table_authority`
  - `table_links`
  - `table_news`
- replication slots exist, are active, and do not show excessive retained WAL
- metadata and news signal topics match the fresh run state recorded by
  `make cdc-up`

`make processing-clean-full` must leave:

- no processing drivers running
- no processing consumer groups
- no stale processing checkpoints
- no dimensions, canonical rows, Redis residue, or Qdrant serving residue

## Troubleshooting

Retained signal replay:
- symptom: offsets jump above DB counts right after connector recreation
- fix: rerun `make cdc-clean` and confirm signal-topic offsets are zero before
  `make cdc-up`

Non-empty signal topics:
- symptom: mutable connector registration is refused
- fix: this is intentional; a full reset requires empty signal topics before
  re-registration

Missing `public.debezium_signal` CDC topics:
- symptom: connector logs show `UNKNOWN_TOPIC_OR_PARTITION`
- fix: rerun `make cdc-up`; the topic bootstrap recreates the required
  `public.debezium_signal` CDC topics

Missing heartbeat topics:
- symptom: connector logs show `UNKNOWN_TOPIC_OR_PARTITION` for
  `__debezium-heartbeat.imperium.<domain>`
- fix: rerun `make cdc-up`; heartbeat topics are part of the required mutable
  topic set

Inactive or lagging replication slots:
- symptom: slot not active, or retained WAL grows above the verification
  threshold
- fix: confirm connector state, then inspect Kafka Connect task logs before
  re-running the reset

Kafka offsets higher than DB counts after a supposed clean rebuild:
- symptom: exact parity fails in `make cdc-verify`
- fix: treat the rebuild as incomplete or dirty state; rerun the full clean
  instead of patching individual topics by hand


  docker-compose --profile source --profile backbone --profile serving --profile processing --profile ui up -d
