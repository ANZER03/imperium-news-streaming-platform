# PRD: Phase 4 Real CDC To Serving Storage

## Problem Statement

Phase 3 built the processing stack and proved that the jobs can run with real
services. Phase 4 must prove the real production-like data path:

Debezium CDC Kafka topics -> Spark processing jobs -> serving storage.

The goal is not backend work yet. Backend is Phase 5. Phase 4 is complete only
when the real CDC topics are connected to the processing stack and the serving
stores contain correct, queryable, replay-safe data.

## Goal

Run the real local processing pipeline from CDC topics into serving storage and
verify it deeply enough that Phase 5 backend can safely build on it.

Serving storage means:

- PostgreSQL for cleaned articles, curated dimensions, taxonomy, embeddings,
  and projection state.
- Redis for feed cards and feed sorted sets.
- Qdrant for article vectors and search payloads.
- Kafka canonical topic for pending and classified article lifecycle events.

## Non-Goals

- No backend API implementation.
- No frontend implementation.
- No production deployment.
- No new source database clone work.
- No smoke-only fixture proof.
- No direct source database reads from serving code.
- No replacing Spark with another processor.

## Current Starting Point

The Phase 3 processing stack already has:

- Spark master and 3 Spark workers.
- Dedicated Spark driver containers for the runtime jobs.
- Spark event logging and history server.
- Real Debezium CDC Kafka topics.
- PostgreSQL runtime tables.
- Redis runtime storage.
- Qdrant collection using 1024-d cosine vectors.
- Medtop taxonomy loaded from
  `apps/processing/news-pipeline/resources/news_topic_taxonomy_medtop_en_us.json`.
- Topic embeddings generated from topic name, description, tags, and sub-topics.
- Qdrant point IDs based on numeric `source_news_id`.

Phase 4 should restart the runtime drivers with the current code, connect them
to the real CDC topics, let them process, and verify every serving store.

## Runtime Jobs

Phase 4 uses the existing processing jobs:

- Dimension materializer.
- Topic embedding refresh job.
- Canonical article processor.
- Classification runtime.
- Redis projector.
- Qdrant projector.

Each long-running job must run as a driver container against the Spark cluster.
Jobs should not be submitted manually inside `spark-master` for the final Phase
4 proof.

Spark worker capacity should be sized for the whole replay, not one job at a
time. The default local target is 3 workers with 4 CPU and 6g memory each so
canonical, classification, Redis, Redis-topics, and Qdrant can run together
without obvious starvation.

Each job must have:

- Stable application name.
- Stable checkpoint directory.
- Clear logs with job name, batch ID, article ID, source news ID, and outcome.
- Visible Spark history data.
- Stable operator-facing debug endpoints for the driver Spark UI plus driver and
  block-manager ports where the image supports them cleanly.
- Restart-safe behavior.

The dimension materializer should run links and authority as independent query
groups with separate checkpoints and bounded offset windows. These two topics
are large, so they should not be processed through one driver-side row
collection loop. Spark executors should decode partitions and write PostgreSQL
batch upserts while the driver tracks only small batch counts.

## CDC Topics

The pipeline must read real Phase 2 Debezium topics for:

- `table_news`
- `table_links`
- `table_authority`
- `table_pays`
- `table_langue`
- `table_rubrique`
- `table_sedition`

The final run should use real topic offsets and real CDC payloads. It must not
use generated fixtures as acceptance proof.

## Processing Flow

1. Dimension CDC events are consumed first and materialized into PostgreSQL
   dimension tables.
2. News CDC events are consumed from the real news topic.
3. The canonical article processor enriches news from curated dimensions.
4. Cleaned articles are upserted into PostgreSQL.
5. Pending canonical article events are published to the canonical Kafka topic.
6. The classifier consumes pending canonical events.
7. The classifier creates article embeddings, compares against PostgreSQL topic
   embeddings using cosine similarity, and writes classification results.
8. Classified canonical events are published back to the canonical topic.
9. Redis projector writes feed cards and feed memberships.
10. Qdrant projector writes vectors and filter payloads.
11. Projection state records latest successful projection state where required.

Dimension jobs should run on a faster cadence than news/classification/projector
jobs so reference data is more likely to land before article processing. Links
and authority should progress in parallel through separate checkpointed query
groups so one large topic does not starve the other. This helps because news
enrichment depends on dimensions. It is not a replacement for correct replay and
retry behavior.

Canonical, classification, Redis, Redis-topics, and Qdrant must each have
their own runtime knobs for offsets and trigger intervals. Classification and
Qdrant must also have their own NVIDIA budget split and embedding batch size
controls instead of sharing one downstream throttle.

## Storage Contracts

### PostgreSQL

PostgreSQL must contain:

- Curated dimensions loaded from real CDC topics.
- Cleaned articles loaded from real news CDC.
- Topic taxonomy loaded from the Medtop JSON resource.
- Topic embeddings with expected vector dimensions.
- Classification results for processed articles.
- Projection state for replay/update cleanup where implemented.

PostgreSQL writes must be idempotent. Reprocessing the same CDC event should
converge on one latest row per article or dimension key.

### Redis

Redis must contain:

- Compact article cards.
- Global latest feed membership.
- Country feed membership where country exists.
- Root topic feed membership after classification.
- Country plus topic feed membership where both exist.

Redis must remove or hide deleted/invisible content from visible feeds.

### Qdrant

Qdrant must contain:

- One point per indexed article using numeric `source_news_id` as point ID.
- 1024-d vectors from the configured embedding model.
- Payload fields needed for filtering:
  - `article_id`
  - `source_news_id`
  - `country_id`
  - `root_topic_id`
  - `primary_topic_id`
  - `language_id`
  - `authority_id`
  - `source_domain`
  - `published_at`
  - `is_visible`

Direct lookup by numeric source news ID must work. Vector search must still
work after switching to numeric point IDs.

### Kafka

Kafka must contain canonical lifecycle events:

- Pending article events.
- Classified article events.
- Stable keys by `article_id`.
- DLQ events for malformed or failed processing where applicable.

## Validation Plan

Phase 4 must validate the real runtime in this order:

1. Confirm all required containers are running.
2. Confirm Spark master sees 3 live workers.
3. Confirm every driver app is visible in Spark UI/history.
4. Confirm CDC source topics exist and have offsets.
5. Confirm PostgreSQL runtime tables exist.
6. Confirm Redis is reachable and old validation-only keys are cleaned.
7. Confirm Qdrant collection exists with correct vector size and distance.
8. Restart Phase 4 runtime drivers with current code.
9. Let dimensions catch up first.
10. Let news, classification, Redis, and Qdrant jobs process real CDC data.
11. Verify PostgreSQL row counts and sample article records.
12. Verify Redis feed keys and sample cards.
13. Verify Qdrant point count, direct point lookup, payload, and vector search.
14. Verify canonical Kafka topic contains pending and classified events.
15. Verify replay by restarting one or more drivers without creating duplicate
    feed or vector side effects.
16. Verify update behavior using one fresh real `table_news` update or insert.
17. Verify delete or visibility behavior if a safe real sample is available.
18. Document every successful check with command, count, and sample ID.

## Acceptance Criteria

Phase 4 is complete when:

- Spark cluster has 3 active workers.
- Runtime jobs run as driver containers, not ad hoc commands inside the master.
- Spark history shows the runtime applications.
- Real CDC topics are the input source.
- PostgreSQL has cleaned articles and dimensions produced from real CDC.
- Redis has real feed cards and feed memberships produced from canonical events.
- Qdrant has real article vectors and searchable payloads.
- Numeric Qdrant point lookup by `source_news_id` works.
- Qdrant vector search returns real processed articles.
- Canonical Kafka topic contains real pending and classified article events.
- Replaying or restarting jobs is idempotent for checked samples.
- At least one real fresh `table_news` update or insert is observed from CDC
  through PostgreSQL, Redis, and Qdrant.
- The validation evidence is documented in a Phase 4 runtime report.

## Required Evidence

The Phase 4 report must include:

- Runtime date and git commit.
- Docker container list for processing services.
- Spark worker count.
- Spark application names and status.
- Kafka CDC topic offsets.
- PostgreSQL counts for dimensions, cleaned articles, taxonomy, embeddings, and
  projection state.
- Redis key counts and sample feed/card records.
- Qdrant collection status, point count, direct point lookup, and vector search
  sample.
- Canonical Kafka sample event keys.
- One end-to-end article sample with:
  - `source_news_id`
  - `article_id`
  - PostgreSQL row proof
  - Redis card/feed proof
  - Qdrant point/search proof
  - classification proof
- Known gaps or risks before Phase 5.

## Recommended Build Order

1. Clean stale validation-only Redis and Qdrant data.
2. Restart all runtime drivers with current code.
3. Verify Spark workers and application history.
4. Let dimension materialization catch up.
5. Process news CDC into PostgreSQL and canonical Kafka.
6. Run classification from canonical Kafka.
7. Project classified and pending events into Redis.
8. Project classified articles into Qdrant.
9. Run the end-to-end validation checklist.
10. Write the Phase 4 runtime report.

## Phase 5 Handoff

Backend work starts only after Phase 4 proves the serving stores are reliable.

Phase 5 can begin when the backend team has:

- Stable Redis feed key contracts.
- Stable PostgreSQL article/detail contracts.
- Stable Qdrant collection and payload contracts.
- A real sample article that exists in PostgreSQL, Redis, and Qdrant.
- A documented runtime report showing the CDC-to-serving path works.
