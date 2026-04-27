# CDC Signal Operations Guide

## Goal

Run incremental snapshots safely for mutable CDC connectors and avoid the
duplicate/replay problems that have repeatedly shown up during Phase 2.

This guide applies to:
- `imperium-metadata-cdc`
- `imperium-news-cdc`

## Mental model

There are three different signal-related pieces. Do not confuse them.

1. Kafka signal topic
   - Metadata: `imperium.metadata.signals`
   - News: `imperium.news.signals`
   - Purpose: carries `execute-snapshot` commands for Debezium.

2. Source signaling table
   - `public.debezium_signal`
   - Purpose: Debezium 2.3 watermarking for incremental snapshots.
   - This table must be included in the publication for mutable connectors.

3. CDC topic for the signaling table
   - Metadata: `imperium.metadata.public.debezium_signal`
   - News: `imperium.news.public.debezium_signal`
   - Purpose: Debezium also produces change events for the source signaling
     table. If this topic is missing, the connector can stall with
     `UNKNOWN_TOPIC_OR_PARTITION`.

The connectors also need heartbeat topics:
- `__debezium-heartbeat.imperium.metadata`
- `__debezium-heartbeat.imperium.news`

## Required topic set

Before running mutable connectors, Kafka must contain all of these topics.

Metadata:
- `imperium.metadata.public.table_authority`
- `imperium.metadata.public.table_links`
- `imperium.metadata.public.debezium_signal`
- `imperium.metadata.schema-history`
- `imperium.metadata.signals`
- `__debezium-heartbeat.imperium.metadata`

News:
- `imperium.news.public.table_news`
- `imperium.news.public.debezium_signal`
- `imperium.news.schema-history`
- `imperium.news.signals`
- `__debezium-heartbeat.imperium.news`

The topic bootstrap scripts are the source of truth:
- `apps/ingestion/topic-bootstrap/metadata/bootstrap-metadata-topics.sh`
- `apps/ingestion/topic-bootstrap/news/bootstrap-news-topics.sh`

## How to send a real signal

The signal emitter scripts default to `--dry-run`. If you omit the mode, they
only print the payload and do not write to Kafka.

Use `run` to actually send the signal.

Metadata:

```bash
set -a
source <(grep -E '^(METADATA_|SOURCE_|KAFKA_BOOTSTRAP_SERVERS=)' .env)
set +a
bash ./apps/ingestion/connector-bootstrap/metadata/emit-full-backfill-signal.sh run
```

News:

```bash
set -a
source <(grep -E '^(NEWS_|SOURCE_|KAFKA_BOOTSTRAP_SERVERS=)' .env)
set +a
bash ./apps/ingestion/connector-bootstrap/news/emit-recent-backfill-signal.sh run
```

Full news rebootstrap only:

```bash
set -a
source <(grep -E '^(NEWS_|SOURCE_|KAFKA_BOOTSTRAP_SERVERS=)' .env)
set +a
bash ./apps/ingestion/connector-bootstrap/news/emit-full-backfill-signal.sh run
```

Important:
- Every signal must use a fresh generated `id`.
- Do not replay old retained signal messages.
- Only emit a signal after the connector is `RUNNING`.

## Safe operating sequence

Use this order for mutable connectors every time:

1. Bootstrap the required Kafka topics.
2. Confirm the signal topic is empty.
3. Register the connector.
4. Confirm connector state is `RUNNING`.
5. Emit one fresh signal with `run`.
6. Verify Kafka output and offsets.

## Common failure modes

### 1. Duplicate backfill after connector recreation

Symptom:
- news topic grows to roughly 2x the expected bounded window
- metadata counts overshoot expected totals

Cause:
- retained `execute-snapshot` records in the Kafka signal topic are replayed
  after connector recreation

Prevention:
- do not recreate mutable connectors while signal topics still contain old
  commands
- use the guard in
  `apps/ingestion/connector-bootstrap/common/connect-signal-guard.sh`
- reset signal topics before connector recreation

### 2. Signal script appears to run but nothing happens

Symptom:
- connector stays healthy
- signal topics remain empty
- no new snapshot activity appears

Cause:
- the emitter script was run without `run`, so it stayed in dry-run mode

Prevention:
- always pass `run` when the intent is to write to Kafka

### 3. Connector warns about `public.debezium_signal`

Symptom:
- Kafka Connect logs show `UNKNOWN_TOPIC_OR_PARTITION` for
  `imperium.<domain>.public.debezium_signal`

Cause:
- the CDC topic for the source signaling table was not created

Fix:
- create the missing `public.debezium_signal` CDC topic
- keep it in the domain topic bootstrap script

### 4. Connector warns about missing heartbeat topics

Symptom:
- Kafka Connect logs show `UNKNOWN_TOPIC_OR_PARTITION` for
  `__debezium-heartbeat.imperium.<domain>`

Cause:
- Debezium heartbeat topics were not created

Fix:
- create the missing heartbeat topic
- keep it in the domain topic bootstrap script

### 5. Connector fails with publication errors

Symptom:
- task fails with `Publication autocreation is disabled`

Cause:
- the publication was not created manually

Fix:
- create the publication in Postgres before registering the connector
- keep `public.debezium_signal` in the mutable publications

## Clean recovery procedure

If mutable ingestion is duplicated, partially replayed, or clearly inconsistent,
use this clean reset procedure.

1. Delete the mutable connectors from Kafka Connect.
2. Delete the mutable Kafka topics for that domain:
   - data topics
   - `public.debezium_signal` CDC topic
   - schema history topic
   - Kafka signal topic
   - Debezium heartbeat topic
3. Recreate the full topic set with the topic bootstrap script.
4. Re-register the connector.
5. Emit exactly one fresh signal with `run`.
6. Re-check offsets against the source DB.

This is slower than patching in place, but it is the safest recovery path when
replay state is ambiguous.

## Verification checklist

After sending a signal, verify all of the following:
- connector state is `RUNNING`
- signal topic contains the new command
- output topic offsets increase
- records can be consumed from the output topic
- logs no longer show `UNKNOWN_TOPIC_OR_PARTITION`
- counts match the source expectation for that connector

Use the source DB as the truth:
- metadata should converge to full table counts
- news should match the bounded 5-day window during normal bounded replays
- news should match the full `table_news` count during the full clean rebuild in
  [`full-cdc-rebootstrap-runbook.md`](./full-cdc-rebootstrap-runbook.md)
