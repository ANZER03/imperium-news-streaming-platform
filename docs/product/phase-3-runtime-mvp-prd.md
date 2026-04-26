# PRD: Phase 3 Runtime MVP From CDC Topics To Serving Stores

## Problem Statement

The Phase 3 processing core now has tested contracts for canonical articles,
dimension materialization, topic classification, Redis projection, Qdrant
projection, projection state, and end-to-end behavior. The next problem is that
the MVP demo still cannot run from real CDC topics into the actual serving
stores.

From the user's perspective, the platform needs to move from tested in-memory
processing behavior to a real local runtime that consumes Phase 2 Debezium CDC
topics, processes the last 5 days of news data, writes PostgreSQL, Redis, and
Qdrant, and exposes enough reliable data for a backend/frontend MVP demo.

The current implementation gap is runtime wiring: concrete CDC decoding,
storage adapters, Kafka topic IO, dedicated job entrypoints, checkpointing,
manual Spark submission commands, and local smoke checks.

Clarification from the 2026-04-26 implementation review: Phase 3 Runtime MVP
work is not considered implemented when it only passes fixture-driven unit
tests, in-memory repositories, or adapter-shape smokes. Those tests are useful
as guardrails, but the remaining runtime issues must prove real processing from
Kafka CDC topics into the actual local serving stores.

## Solution

Build the Phase 3 Runtime MVP as a local Docker Compose based processing stack
that consumes raw Debezium Avro CDC topics directly, processes a controlled
5-day data window, and writes real PostgreSQL, Redis, Qdrant, and canonical
Kafka outputs.

The acceptance bar for every remaining runtime slice is live local processing:
Spark jobs must read the configured Debezium Kafka topics, decode the real Avro
envelopes, and write to the configured PostgreSQL, Redis, Qdrant, and Kafka
destinations. Abstraction-only work, fake CDC fixtures, and in-memory smokes
cannot close `#26`, `#27`, or `#28`.

The first runtime target is local only. The first execution mode is manual
`spark-submit` so each job can be debugged independently before codifying the
jobs as dedicated Compose driver services.

Runtime update on 2026-04-26: the Phase 3 jobs are now being codified as
dedicated driver containers, one per job, with Spark event logging enabled and
a Spark history server for post-run debugging. Each driver keeps its own
checkpoint directory and runs independently of the others.

Runtime update on 2026-04-26, later in the same rollout: the Spark cluster now
uses 3 workers. Dimension materialization runs on the fastest trigger cadence,
news canonical processing uses a 5 second cadence, and classification plus
Redis/Qdrant projection use 15 second cadences. That bias helps dimensions land
before news without relying on topic timing luck.

The runtime will keep the Phase 3 PRD boundaries:

- PostgreSQL stores durable cleaned articles, curated dimensions, topic
  taxonomy, topic embeddings, and projection state.
- Redis stores compact feed cards and feed sorted sets for low-latency serving.
- Qdrant stores article vectors and filter payloads for semantic retrieval.
- Redis and Qdrant projection jobs run separately so one store failure does not
  block the other.
- One `phase3.canonical-articles` topic carries both pending and classified
  canonical article versions. Consumers use `article_id` and projection state so
  latest state wins and replay remains idempotent.
- Real NVIDIA embeddings are used from the start for MVP classification and
  Qdrant vectors, assuming `NVIDIA_API_KEY` is configured.

The first backend/frontend MVP surface will be the global latest feed. Feed
lists read compact article cards from Redis, while article details read the
durable cleaned article from PostgreSQL. Delete and visibility behavior will be
proven at the storage level for the MVP demo: Redis membership and cards are
removed, and Qdrant payload visibility is set to false.

## User Stories

1. As a platform engineer, I want Phase 3 jobs to consume raw Debezium Avro CDC topics directly, so that Kafka remains the source of truth for runtime processing.
2. As a platform engineer, I want a reusable CDC decoder boundary, so that all Phase 3 jobs parse inserts, updates, and deletes consistently.
3. As a platform engineer, I want the runtime to process only the last 5 days for the MVP, so that the demo can run quickly with controlled cost and risk.
4. As a platform engineer, I want dimension CDC events to materialize curated PostgreSQL dimension tables, so that article processing avoids per-record source database lookups.
5. As a platform engineer, I want country resolution to use authority sedition country first and link country as fallback, so that feed grouping follows the Phase 3 contract.
6. As a platform engineer, I want news CDC events to become canonical pending article events, so that downstream jobs consume a stable article contract.
7. As a platform engineer, I want cleaned articles upserted into PostgreSQL by `article_id`, so that replay and updates converge on the latest durable article state.
8. As a platform engineer, I want canonical pending events published to one canonical Kafka topic, so that classifiers and projectors can consume a single stream.
9. As a data engineer, I want the topic taxonomy seeded in PostgreSQL, so that classification has a durable taxonomy source of truth.
10. As a data engineer, I want a topic embedding refresh job using real NVIDIA embeddings, so that topic vectors match the provider used for article classification.
11. As a data engineer, I want topic embeddings stored in PostgreSQL, so that classification does not depend on Qdrant for taxonomy comparison.
12. As a platform engineer, I want an embedding gateway boundary with batching, rate limits, retries, and API key isolation, so that Spark executors do not independently hammer the NVIDIA API.
13. As a platform engineer, I want article classification to read pending canonical events, so that topic classification is asynchronous from first article emission.
14. As a platform engineer, I want classification to publish updated canonical events to the same canonical topic, so that consumers receive both lifecycle states through one contract.
15. As a platform engineer, I want classification failures to keep articles visible in non-topic feeds, so that feed freshness does not depend on successful topic classification.
16. As a feed consumer, I want global feed cards to appear before classification completes, so that fresh content appears quickly.
17. As a feed consumer, I want root topic feed membership after classification completes, so that topic pages can be populated from broad topics.
18. As a feed consumer, I want country feed membership when country data exists, so that country-filtered browse surfaces work.
19. As a search consumer, I want Qdrant points with vectors and filter payloads, so that semantic and filtered search can work for the MVP.
20. As a search consumer, I want Qdrant payloads to include country, root topic, primary topic, language, authority, rubric, source domain, date, and visibility, so that search filters can be applied without PostgreSQL joins.
21. As a platform engineer, I want Redis and Qdrant projector jobs to be separate, so that one serving store outage does not block the other.
22. As a platform engineer, I want projection state persisted in PostgreSQL, so that replays, country changes, topic changes, deletes, and visibility changes clean old Redis memberships safely.
23. As a platform engineer, I want exact replay to be idempotent, so that restarting jobs does not create duplicate feed or vector side effects.
24. As a platform engineer, I want delete and visibility changes to remove Redis card/feed state and mark Qdrant invisible, so that hidden content leaves product surfaces.
25. As a backend engineer, I want Redis to serve the global latest feed, so that the first MVP screen has low-latency data.
26. As a backend engineer, I want PostgreSQL cleaned articles to serve article detail, so that full article bodies do not need to live in Redis.
27. As a frontend engineer, I want a stable global feed contract, so that the first MVP screen can be implemented without depending on raw source schemas.
28. As a product reviewer, I want the MVP demo to show real processed news from CDC, so that the demo proves the new event-driven architecture.
29. As a product reviewer, I want storage-level delete and visibility proof, so that content removal behavior is demonstrable without requiring an admin UI.
30. As a developer, I want manual `spark-submit` commands first, so that each job can be debugged before it is turned into a long-running Compose service.
31. As a developer, I want separate checkpoint locations per streaming job, so that job identity and replay state stay isolated.
32. As an operator, I want local smoke checks for PostgreSQL, Redis, Qdrant, Kafka lag, and checkpoint progress, so that runtime health is visible during the demo.
33. As an operator, I want clear pass/fail validation after the first CDC run, so that the team knows whether the MVP data path is ready for backend/frontend work.
34. As an operator, I want failures to be isolated by job, so that restarting a classifier or projector does not require resetting the entire stack.
35. As an engineer, I want all runtime dependencies injected behind interfaces, so that core Phase 3 logic remains testable and storage clients can be replaced.
36. As an engineer, I want adapter tests around CDC decoding and storage writes, so that runtime wiring failures are caught before full stack runs.
37. As an engineer, I want the canonical event contract to stay stable, so that backend and frontend work can proceed while processors evolve internally.
38. As an engineer, I want logs to include article IDs, source news IDs, batch IDs, and job names, so that CDC processing can be traced during debugging.
39. As an engineer, I want a controlled transition from local runtime to later production canary, so that the MVP demo does not create production risk.
40. As a team lead, I want the build order documented, so that work can proceed one runtime slice at a time.

## Implementation Decisions

- The MVP runtime processes a 5-day news window first.
- The MVP runtime target is the local Docker Compose stack only.
- Phase 3 consumes raw Debezium Avro CDC topics directly instead of creating a flattened intermediate input layer.
- Runtime issue completion requires real local Kafka CDC input and real local storage output. Unit tests and fixture smokes may support the work, but they are not sufficient acceptance evidence.
- `#26` starts with real processing from Phase 2 CDC topics to PostgreSQL cleaned/dimension tables, canonical Kafka output, and Redis global/country feed state.
- `#27` continues from real pending canonical Kafka events to real NVIDIA classification, PostgreSQL updates, Redis topic feeds, and Qdrant vectors.
- `#28` validates the complete real local runtime after clean restart and replay; it is not a documentation-only handoff.
- Redis and Qdrant projectors are separate jobs from the start.
- Real NVIDIA embeddings are used from the start for topic embedding refresh, article classification, and Qdrant vector projection.
- One canonical topic carries both pending and classified canonical article events.
- The first MVP screen is the global latest feed.
- Feed lists use Redis compact cards and feed sorted sets.
- Article detail uses PostgreSQL cleaned article records.
- Delete and visibility behavior is proved at the storage level for the MVP demo.
- The first runtime execution mode is manual `spark-submit`; Compose driver services are added after adapters and job behavior are proven.
- The CDC decoder module should be a deep module with a small interface that translates Debezium Avro envelopes into table-specific change records.
- The runtime configuration module should centralize environment parsing, topic names, checkpoint paths, store URLs, credentials, and data-window settings.
- PostgreSQL adapters should implement repositories for curated dimensions, cleaned articles, topic taxonomy, topic embeddings, and projection state.
- Kafka adapters should implement canonical article producer/consumer behavior and preserve event keys by `article_id`.
- Redis adapters should implement feed card, global feed, country feed, root topic feed, and country+topic feed operations.
- Qdrant adapters should implement collection setup, point upsert, payload update, and visibility updates by `article_id`.
- Embedding gateway adapters should isolate NVIDIA API credentials and enforce configured batching, rate limiting, retries, and failure handling.
- Dimension materializer runtime should consume reference and metadata CDC topics and write curated PostgreSQL dimension tables.
- Topic embedding refresh runtime should read taxonomy from PostgreSQL, create embedding inputs, call the embedding gateway, and write active topic embeddings.
- The taxonomy seed source is `apps/processing/news-pipeline/resources/news_topic_taxonomy_medtop_en_us.json`, and topic embedding text should use topic name, description, tags, and sub-topics so classification stays close to the Medtop hierarchy.
- Canonical article runtime should consume news CDC, enrich from curated dimensions, upsert cleaned articles, and publish pending canonical events.
- Classifier runtime should consume canonical pending events, classify using PostgreSQL topic embeddings and real article embeddings, upsert cleaned articles, and publish classified canonical events.
- Redis projector runtime should consume canonical events and update compact cards and feed sorted sets.
- Qdrant projector runtime should consume canonical events eligible for vector indexing and upsert vectors and filter payloads.
- Projection state should remain PostgreSQL-backed and should be updated only after successful projection behavior for the relevant job.
- Each streaming job should have a stable, separate checkpoint location.
- Each runtime job should run in its own dedicated driver container rather than
  being launched interactively inside `spark-master`.
- Spark event logging should remain enabled for every runtime driver, and the
  event logs should be persisted to a shared volume read by Spark History
  Server.
- Runtime logs should include job name, batch ID, `article_id`, `source_news_id`, event operation, and outcome.
- The initial backend/frontend MVP should start after a local smoke proves CDC data appears in PostgreSQL, Redis, and Qdrant.

## Testing Decisions

- Good tests validate observable behavior and contracts, not implementation details.
- For runtime issues, the primary acceptance evidence is an executed local run against real services: Kafka CDC topics, PostgreSQL tables, Redis keys, Qdrant collection points, and canonical Kafka output.
- Fixture-only tests, DB-API doubles, in-memory repositories, and smoke fixtures are safety nets only. They must not be used as proof that the runtime MVP is implemented.
- CDC decoder tests should cover inserts, updates, deletes, tombstones if present, Avro envelope fields, and invalid/missing payload behavior.
- Runtime config tests should cover required environment variables, defaults, invalid values, and per-job checkpoint construction.
- PostgreSQL adapter tests should validate idempotent upsert behavior, latest-wins semantics, and state lookup behavior using a disposable database or strict DB-API doubles.
- Kafka adapter tests should validate event keying, canonical topic publication, and consumer filtering for pending versus classified states.
- Redis adapter tests should validate card writes, feed membership writes, old membership removal, delete cleanup, and idempotent replay.
- Qdrant adapter tests should validate collection setup, point upsert payload fields, vector dimensions, visibility updates, and idempotent replay.
- Embedding gateway tests should continue to cover batching, 40 RPM rate limiting, retry/backoff, and failed-batch splitting.
- Job-level tests may use small in-memory or test-double inputs for fast feedback, but each runtime issue also needs a live local execution against real configured services before completion.
- End-to-end local smoke must run controlled real CDC input through Kafka and report pass/fail for PostgreSQL, Redis, Qdrant, canonical topic, replay, and delete/visibility behavior.
- Prior art for tests is the existing Phase 3 processing unittest suite and end-to-end smoke report that validate observable outputs across dimensions, canonical processing, classification, Redis, Qdrant, replay, and visibility cleanup.

## Out of Scope

- Production deployment.
- Production canary rollout.
- Full backend API implementation beyond the contracts needed to plan the MVP.
- Full frontend implementation.
- Personalized ranking.
- Recommendation engine.
- User activity tracking.
- Notifications.
- Multi-region deployment.
- Full search replacement.
- Admin UI for delete and visibility changes.
- Processing all historical cloned data in the first MVP pass.
- Flattened Kafka topic architecture before raw CDC decoding is proven.

## Further Notes

This PRD starts after Phase 3 core issue work and end-to-end in-memory
validation. It is the bridge from tested processing contracts to real local
runtime processing.

The first milestone is not a polished product UI. The first milestone is a
validated local data path: Debezium CDC topics to PostgreSQL cleaned/state
tables, Redis feed/card data, Qdrant vectors/payloads, and a canonical Kafka
topic that backend/frontend work can trust.

Going forward, implementation should start from the real local runtime path and
only add abstractions when they directly help the real jobs run. The next work
on `#26` must wire Spark consumption of actual Phase 2 CDC topics and verify
real rows/events/keys in PostgreSQL, Kafka, and Redis.

The implementation should proceed one runtime slice at a time:

1. CDC Avro decoder and runtime configuration.
2. PostgreSQL, Kafka, Redis, Qdrant, and embedding runtime adapters.
3. Dimension materializer from CDC topics to PostgreSQL.
4. Topic embedding refresh using NVIDIA.
5. Canonical article processor from news CDC to PostgreSQL and canonical Kafka.
6. Classifier from canonical Kafka to classified canonical events.
7. Redis projector from canonical Kafka.
8. Qdrant projector from canonical Kafka.
9. Local runtime smoke from controlled CDC event to PostgreSQL, Redis, and Qdrant.
10. MVP backend/frontend planning and implementation.
