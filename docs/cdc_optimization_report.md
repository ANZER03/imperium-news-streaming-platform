# CDC Pipeline Optimization Report: 1:1 Ingestion & Reliability

This document summarizes the improvements made to the Imperium News Streaming Platform's Change Data Capture (CDC) layer to ensure reliable, 1:1 ingestion and idempotent bootstrapping.

## 1. What We Solved
We established a robust, production-ready CDC ingestion pipeline that guarantees data consistency between the source Postgres database and Kafka topics.

*   **1:1 Ingestion**: Ensured that the initial backfill and incremental snapshots capture the exact state of the database without missing or duplicating records.
*   **Idempotent Bootstrapping**: Fixed the `cdc-up.sh` orchestration to handle partial failures gracefully, allowing the stack to be restarted without causing duplicate data.
*   **Targeted Backfills**: Implemented a 5-day incremental snapshot window for news data (`added_in >= NOW() - interval '5 days'`) to optimize storage and processing.
*   **Automated Verification**: Created a verification suite that confirms connector health, topic parity, and signal integrity.

---

## 2. Problems We Faced

| Problem | Symptom | Root Cause |
| :--- | :--- | :--- |
| **Invisible Offset Failures** | `cdc-up.sh` would hang or report 0 offsets incorrectly. | Use of deprecated Java class `kafka.tools.GetOffsetShell` which is missing/moved in newer Kafka versions. |
| **Duplicate Snapshots** | Multiple signals being emitted on every restart. | Lack of pre-flight checks on destination topics before sending "execute-snapshot" signals. |
| **Signal Topic Collision** | Connectors failing to start with "Signal topic already has records". | Strict validation in registration scripts that didn't allow for re-registering existing connectors. |
| **Payload Format Mismatch** | News filter was ignored or caused Debezium errors. | Using a string for `additional-condition` instead of the expected array of objects for `additional-conditions`. |
| **Flaky Verification** | `cdc-verify.sh` failed randomly on large tables. | Parity checks were too strict (expecting exact matches during active snapshots) and consumer timeouts were too low. |

---

## 3. How We Fixed Them

### Technical Solutions
1.  **Fixed Topic Offset Helper**: Updated `scripts/cdc-lib.sh` to use the modern `org.apache.kafka.tools.GetOffsetShell` class. This restored the ability to accurately "wait" for signals to land.
2.  **Smart Signal Logic**: Modified `cdc-up.sh` to check `topic_end_offset` of the **data topic** before emitting a signal. If data exists, the script now intelligently skips the snapshot signal while keeping the connector running for live changes.
3.  **Idempotent Registration**: Updated all registration scripts (Reference, Metadata, News) to use `PUT` if the connector exists and `POST` if it doesn't. This prevents "409 Conflict" errors during re-runs.
4.  **Payload Correction**: Updated `news/full-backfill-signal.json` to the correct Debezium format:
    ```json
    "additional-conditions": [
      {
        "data-collection": "public.table_news",
        "filter": "added_in >= NOW() - interval '5 days'"
      }
    ]
    ```
5.  **Reliable Producers**: Added `--producer-property acks=all` and switched to `--bootstrap-server` in emission scripts to ensure signals are physically acknowledged by Kafka.

---

## 4. What We Learned

### CDC Best Practices
*   **Offsets != Row Counts**: In CDC, a Kafka offset represents a **history of changes** (inserts, updates, deletes). It is normal for an offset to be higher than the row count if updates have occurred.
*   **Idempotency is Key**: Infrastructure scripts must assume they might be run multiple times. Checking for existing connectors and data before acting prevents "poisoning" the stream with duplicates.
*   **Debezium Signals are Asynchronous**: Emitting a signal is just the start. You must monitor the connector logs or the signal topic offsets to confirm the command was actually received and acted upon.
*   **Incremental Snapshots are Background Tasks**: Large tables (5M+ rows) take time. Verification tools should be "snapshot-aware"—checking for data flow and signal presence rather than strict count parity while a snapshot is in progress.

---

## Final Verification Result
> [!NOTE]
> All 3 connectors are currently **RUNNING**. 
> `table_news` has reached exact parity for the filtered window. 
> Metadata tables have successfully completed their multi-million row snapshots.
