# Source CDC readiness runbook

## Goal

Decide whether the production PostgreSQL source is ready for Debezium CDC
without mutating the source database.

## Go / no-go rules

Go only if all checks pass:

- `wal_level = logical`
- replication slots are available for the planned connectors
- WAL sender capacity can support the planned connectors
- the Debezium user has the required replication and read privileges
- publications are planned and created manually
- connector validation does not require inserts, updates, deletes, or DDL on the source

No-go if any required value is missing, undersized, or unclear.

## Readiness checklist

### 1) Confirm PostgreSQL CDC settings

Run against the production source:

```bash
psql "$SOURCE_DATABASE_URL" -c "show wal_level;"
psql "$SOURCE_DATABASE_URL" -c "show max_replication_slots;"
psql "$SOURCE_DATABASE_URL" -c "show max_wal_senders;"
```

Expected:
- logical WAL enabled
- enough slots for each connector plus operational headroom
- enough WAL senders for the planned connector count

### 2) Confirm Debezium privileges

Verify the connector user can:
- connect to the source database
- read the required tables
- use replication privileges

If the required grants are missing, stop and fix them before rollout.

### 3) Confirm publication policy

- Publications are created manually.
- Connector startup must not create or alter source publications (`publication.autocreate.mode: disabled`).
- Publication names should be explicit and domain-scoped.
- **Important**: For Debezium 2.3 incremental snapshots, the `public.debezium_signal` table must be included in each publication that requires signaling.

### 4) Signaling and Watermarking (Debezium 2.3)

- Incremental snapshots require a signaling table: `public.debezium_signal`.
- The table must have the structure: `id VARCHAR(64) PRIMARY KEY, type VARCHAR(64) NOT NULL, data VARCHAR(2048)`.
- The connector user must have `SELECT, INSERT, UPDATE, DELETE` privileges on this table.
- This table acts as a watermarking mechanism even when signals are triggered via Kafka.
- Kafka signal topics must be treated as replay-sensitive operational state.
- Do not re-register a connector while its signal topic still contains retained `execute-snapshot` commands.
- Use a generated unique signal `id` for every backfill request.
- Reset the signal topic before connector recreation when previous backfill commands must not be replayed.

### 4) Confirm replication-slot policy

- Use one slot per connector.
- Slot names should be explicit and easy to clean up.
- Retired slots must be removed deliberately.
- Stalled connectors must be treated as WAL-retention risk.

### 5) Confirm safety rules

- Do not require source mutations for validation.
- Do not use source inserts or updates as a test harness.
- Validate through connector state, Kafka records, and schema registration.

## Recommended manual verification order

1. Check source settings.
2. Check connector privileges.
3. Confirm publication and slot naming.
4. Confirm the relevant signal topic is empty before connector registration.
5. Register the connector only after the source is declared ready.
6. Emit a new unique backfill signal only after connector health is verified.
7. Validate Kafka output and schema registration.

## Output

Record one of these outcomes:

- **GO** — the source is ready for connector rollout.
- **NO-GO** — one or more prerequisites are missing or ambiguous.

## Next phase links

- Phase 2 decision note: [`../product/phase-2-cdc-decision.md`](../product/phase-2-cdc-decision.md)
- Signal operations guide: [`./cdc-signal-operations-guide.md`](./cdc-signal-operations-guide.md)
- Issue group: [Phase 2 parent issue #8](https://github.com/ANZER03/imperium-news-streaming-platform/issues/8)

## News backfill policy

The dedicated news connector uses Kafka signals for bounded incremental
backfill. The backfill window is intentionally limited (default: 5 days) and
must not fall back to a full historical snapshot.
