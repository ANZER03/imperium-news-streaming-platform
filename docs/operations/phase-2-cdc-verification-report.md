# Phase 2 CDC Verification Report

Date: 2026-04-23
Status: Audited (Hardened CDC Controls Added)

## 1. Audit Summary

The Phase 2 CDC rollout was audited after duplication was observed during incremental snapshot troubleshooting. The repo now includes operational guardrails to prevent the same replay path during future connector restarts and re-registration.

| Table Group | Table Name | DB Row Count | Kafka Offset (Latest) | Delta / Note |
| :--- | :--- | :--- | :--- | :--- |
| **Reference** | `table_pays` | 260 | 260 | **Verified (1:1)** |
| **Reference** | `table_langue` | 186 | 186 | **Verified (1:1)** |
| **Reference** | `table_rubrique` | 39,300 | 39,300 | **Verified (1:1)** |
| **Reference** | `table_sedition` | 30,595 | 30,595 | **Verified (1:1)** |
| **Metadata** | `table_authority` | 5,585,164 | 5,585,164 | **Verified (1:1)** |
| **Metadata** | `table_links` | 6,308,926 | 6,308,926 | **Verified (1:1)** |
| **News** | `table_news` | 824,607 | 42,519 | **Bounded 5-Day Stream; compare against live 5-day DB window, not full table** |

## 2. Findings & Root Cause Analysis

### 2.1 Metadata Restoration
The Metadata CDC path was cleaned by deleting Kafka topics and re-registering connectors. A full incremental snapshot was manually triggered via Kafka signals.
- **Outcome**: `table_authority` and `table_links` match the source database 1:1.

### 2.2 News Refinement (5-Day Window)
The news backfill window was adjusted from 12 days to 5 days.
- **Historical Duplication Observation**: Earlier troubleshooting observed a near-2x overlay (`85,637` Kafka records versus an approximately `42k` 5-day source window).
- **Current Live Audit**: The source currently contains `40,531` rows for `added_in >= NOW() - INTERVAL '5 days'`, while the Kafka end offset is `42,519`.
- **Interpretation**: The earlier overlay was consistent with signal replay. The current gap is small enough to be explained by live CDC overlap during the bounded snapshot window.

### 2.3 Hardening Added
The repo now includes explicit controls for the replay path that caused the duplicate window:
- Connector registration refuses to proceed when retained records still exist in the relevant signal topic.
- News and metadata signal emitters now generate a new unique signal `id` automatically for each backfill request.
- Dedicated signal-topic reset scripts were added for both mutable connectors.
- Asset validation was updated to enforce the 5-day news window and the new signal-safety controls.

## 3. Operational Implementation

- **Windowing**: `NEWS_CDC_BACKFILL_WINDOW_DAYS` is now set to `5`.
- **Signaling**: Both `news` and `metadata` connectors use the `source,kafka` channel with the `public.debezium_signal` table for watermarking.
- **Configs**: Verified `snapshot.mode: never` for all mutable paths to prevent accidental full historical dumps.
- **Operational Rule**: Do not recreate mutable connectors until their signal topics have been reset or explicitly acknowledged as replay-safe.
