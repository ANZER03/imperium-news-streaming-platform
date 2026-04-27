# Phase 3 PRD

## Imperium Processing Phase - Canonical Article, Topic Taxonomy, and Serving Projections

## 1. Overview

This phase turns raw CDC streams into a product-ready article model and
separates serving concerns from processing concerns.

Goal:
- build one canonical article contract
- enrich news with large dimensions without blocking the system
- classify articles into hierarchical business topics with embedding similarity
- project articles into Redis for recent feeds and Qdrant for semantic search
- keep PostgreSQL as durable cleaned storage and dimension materialization

## 2. Problem Statement

Raw CDC records are not product-ready.

Problems this phase solves:
- news rows lack complete display shape
- source/link/authority data is large and cannot be treated as tiny lookup data
- feed cards need short text, image, country, topic, and source context
- semantic search needs embeddings plus filter payloads
- Redis and Qdrant must not block each other

## 3. Product Goal

Convert raw CDC into:
- one canonical article event
- one cleaned durable article record
- one Redis feed/card projection
- one Qdrant vector projection

## 3.1 User Stories

1. As a platform engineer, I want raw CDC news records to become canonical
   articles, so that downstream systems consume one stable contract.
2. As a platform engineer, I want canonical articles to include display,
   source, country, visibility, and processing metadata, so that serving and
   search do not depend on raw source tables.
3. As a feed user, I want recent articles to appear quickly in global and
   country feeds, so that feed freshness does not wait for topic classification.
4. As a feed user, I want topic feeds to use broad root topics, so that topic
   pages are populated and easy to browse.
5. As a search user, I want article embeddings and filter payloads in Qdrant, so
   that semantic and filtered search can find relevant articles.
6. As a data engineer, I want topic taxonomy to be hierarchical and versioned,
   so that broad topics and leaf topics stay consistent.
7. As a data engineer, I want topic metadata to include multilingual
   descriptions and tags, so that embedding classification works across
   languages.
8. As a data engineer, I want topic embeddings precomputed in PostgreSQL, so
   that article classification can compare against stable topic vectors.
9. As a platform engineer, I want Spark to classify articles through a
   centralized embedding service, so that batching, rate limits, retries, and
   API keys are controlled in one place.
10. As a platform engineer, I want Redis and Qdrant projectors to fail
    independently, so that a search outage does not block feeds and a Redis
    outage does not block indexing.
11. As a platform engineer, I want delete and visibility updates to clean Redis
    and mark Qdrant invisible, so that hidden content stops appearing in
    product surfaces.
12. As an engineer, I want every service to depend on abstractions, so that
    storage clients, embedding providers, and projectors can be replaced without
    changing core processing logic.

## 4. In Scope

- canonical article schema design
- topic taxonomy schema and classification flow
- embedding-only topic classification using NVIDIA `baai/bge-m3`
- deterministic excerpt generation
- dimension projection for large tables
- Redis feed projection
- Qdrant vector projection
- Postgres cleaned article storage
- replay-safe upsert behavior
- service contracts based on dependency injection and abstractions

## 5. Out of Scope

- personalized ranking
- recommendations
- user activity tracking
- notifications
- full search replacement
- multi-region serving

## 6. Core Decision

Canonical article is the main contract between processing and serving.

Raw CDC topics feed the processor.
Processor emits canonical article as soon as minimum article fields are valid.
Topic classification runs asynchronously and emits an updated canonical article
when classification completes.
Redis and Qdrant consume canonical article independently.

All services must be designed with dependency injection and must depend on
abstractions, not concrete implementations. Storage clients, embedding clients,
classifiers, projectors, repositories, clocks, and configuration providers should
be replaceable behind interfaces. The system should be closed to modification
for stable service contracts and open to extension for alternate
implementations.

Primary deep modules:
- canonical article builder
- dimension enrichment service
- excerpt generator
- topic taxonomy service
- topic embedding service
- embedding gateway service
- embedding similarity classifier
- Redis feed projector
- Qdrant vector projector
- cleaned article repository
- projection state repository

Each module should expose a small stable interface and hide provider-specific
details behind adapters.

## 6.1 Runtime Topology

Phase 3 should run as separate long-running runtime units. Each Spark job should
be submitted from its own driver container instead of using `spark-master` as
the shared driver for every job.

Default Spark cluster roles:
- `spark-master` coordinates the cluster only
- `spark-worker` containers execute tasks
- one dedicated driver container owns one long-running Spark job
- each streaming job uses its own stable checkpoint location
- each job has separate environment, logs, restart policy, and failure boundary

Recommended runtime units:
1. `phase3-dimension-materializer`
   - Spark job.
   - Reads reference and metadata CDC topics.
   - Writes curated PostgreSQL dimension tables.
2. `phase3-canonical-article-processor`
   - Spark job.
   - Reads news CDC.
   - Enriches from curated PostgreSQL dimensions.
   - Writes cleaned article PostgreSQL records.
   - Emits canonical article events with `classification_status = pending`.
3. `phase3-topic-embedding-refresh`
   - Batch Python or Spark job.
   - Reads PostgreSQL topic taxonomy.
   - Calls the embedding gateway.
   - Writes PostgreSQL topic embeddings.
4. `phase3-embedding-gateway`
   - Internal service, not a Spark job.
   - Owns NVIDIA API keys, batching, global rate limiting, retries, and metrics.
5. `phase3-article-classifier`
   - Spark job.
   - Reads pending canonical article events.
   - Calls the embedding gateway for article embeddings.
   - Compares article embeddings against active PostgreSQL topic embeddings.
   - Emits updated canonical article events with classification fields.
6. `phase3-redis-projector`
   - Python worker or Spark job.
   - Reads canonical article events.
   - Writes Redis cards, global feeds, country feeds, and root topic feeds.
   - Handles delete and visibility cleanup.
7. `phase3-qdrant-projector`
   - Python worker or Spark job.
   - Reads canonical article events that are eligible for vector indexing.
   - Writes Qdrant vectors and filter payloads.
   - Marks hidden or deleted articles as `is_visible = false`.

Target runtime count:
- 7 runtime units total
- 4 Spark driver containers when `phase3-topic-embedding-refresh` runs on Spark
- 3 non-Spark service or worker containers

Spark driver containers must all submit to the same cluster with
`--master spark://spark-master:7077`, but they must not share checkpoint
directories. A streaming checkpoint path is part of a job identity and belongs
to exactly one job.

## 6.2 Stores, Tables, Collections, and Topics

Physical stores:
- PostgreSQL for durable cleaned storage, curated dimensions, topic taxonomy,
  topic embeddings, classification status, and projection state
- Redis for recent feed cards and feed sorted sets
- Qdrant for article vectors and semantic-search filter payloads

Recommended PostgreSQL Phase 3 tables:
- `phase3_cleaned_articles`
- `phase3_dim_links`
- `phase3_dim_authorities`
- `phase3_dim_countries`
- `phase3_dim_rubrics`
- `phase3_dim_languages`
- `phase3_dim_seditions`
- `phase3_topic_taxonomy`
- `phase3_topic_embeddings`
- `phase3_projection_state`

Qdrant collections:
- `phase3_articles`

Redis key families:
- `article:{article_id}`
- `feed:global`
- `feed:country:{country_id}`
- `feed:topic:{root_topic_id}`
- `feed:country:{country_id}:topic:{root_topic_id}`

Phase 3 consumes existing Phase 2 CDC topics for:
- `table_news`
- `table_links`
- `table_authority`
- `table_pays`
- `table_rubrique`
- `table_langue`
- `table_sedition`

Minimum new Phase 3 Kafka topics:
- `phase3.canonical-articles`
- `phase3.canonical-articles.dlq`

Recommended new Phase 3 Kafka topics:
- `phase3.canonical-articles`
- `phase3.canonical-articles.dlq`
- `phase3.dimension-events`
- `phase3.classification-failures`

## 7. Data Model

### 7.1 Canonical Article

Minimum fields:
- `article_id`
- `source_news_id`
- `link_id`
- `authority_id`
- `country_id`
- `country_name`
- `source_name`
- `source_domain`
- `rubric_id`
- `rubric_title`
- `root_topic_id`
- `root_topic_label`
- `primary_topic_id`
- `primary_topic_label`
- `topic_confidence`
- `topic_candidates`
- `classification_status`
- `classification_method`
- `title`
- `url`
- `body_text`
- `body_text_clean`
- `excerpt`
- `image_url`
- `video_url`
- `reporter`
- `source_date_text`
- `published_at`
- `crawled_at`
- `meta_keywords`
- `meta_description`
- `is_video`
- `is_valid`
- `is_visible`
- `is_deleted`
- `dimension_status`
- `missing_dimensions`
- `classification_model`
- `classified_at`
- `classification_input_hash`
- `schema_version`
- `processed_at`

`article_id` must be deterministic and namespaced from the source system. For
Phase 3 the recommended format is `news:{source_news_id}`. The original source
identifier must still be stored in `source_news_id`.

### 7.2 Redis Feed Card

Redis `article:{article_id}` stores compact card data only:
- `article_id`
- `title`
- `url`
- `excerpt`
- `image_url`
- `source_name`
- `source_domain`
- `rubric_title`
- `country_id`
- `country_name`
- `root_topic_id`
- `root_topic_label`
- `topic_confidence`
- `published_at`
- `ingested_at`
- `is_video`
- `has_image`
- `language_id`
- `language_code`

Feed sorted sets store only `article_id`:
- `feed:global`
- `feed:country:{country_id}`
- `feed:topic:{root_topic_id}`
- `feed:country:{country_id}:topic:{root_topic_id}`

Redis indexes root topic feeds only in Phase 3. Leaf topics are still stored in
the canonical article and Qdrant payload for search, audit, and future
specific-topic feeds.

### 7.3 Qdrant Payload

Qdrant stores:
- vector embedding
- payload filters

Payload fields:
- `article_id`
- `country_id`
- `root_topic_id`
- `primary_topic_id`
- `secondary_topic_ids`
- `topic_tags`
- `authority_id`
- `language_id`
- `rubric_id`
- `published_at`
- `is_visible`
- `source_domain`

## 8. Topic Taxonomy

Topic taxonomy is hierarchical and stored in PostgreSQL.

Example structure:
- `topic_id`
- `parent_topic_id`
- `topic_key`
- `display_name`
- `description`
- `tags`
- `translations`
- `is_active`
- `model_hint`
- `taxonomy_version`
- `created_at`
- `updated_at`

Rules:
- one primary leaf topic per article
- optional secondary topics for debug and search
- topic taxonomy is source of truth in PostgreSQL
- classifier returns only the primary leaf topic
- root topic is derived deterministically from PostgreSQL taxonomy
- topic descriptions, multilingual descriptions, tags, multilingual tags, and
  model hints are used to build topic embedding input

### 8.1 Topic Embeddings

Topic embeddings are precomputed and stored in PostgreSQL.

Recommended structure:
- `topic_id`
- `taxonomy_version`
- `embedding_model`
- `embedding_dimension`
- `embedding_input_text`
- `embedding_input_hash`
- `embedding_vector`
- `is_active`
- `created_at`
- `updated_at`

Topic embeddings must be regenerated when taxonomy metadata, descriptions,
translations, tags, model hints, taxonomy version, or embedding model changes.
Spark loads active topic embeddings from PostgreSQL and broadcasts them for
classification. Qdrant is not required for topic classification in Phase 3.

## 9. Classification

Classification is embedding-similarity only in Phase 3.

Embedding provider:
- API base URL: `https://integrate.api.nvidia.com/v1`
- model: `baai/bge-m3`
- encoding format: `float`
- truncate: `NONE`
- maximum API batch size: `8191`
- default configured batch size: `8191`
- global rate limit: `40` requests per minute

Input:
- `title`
- first 30 cleaned words from `body_text_clean`

Article classification input:
- `{title}`
- `{first_30_clean_words_from_body_text_clean}`

Topic classification input:
- topic display name
- topic description
- topic tags
- multilingual labels, descriptions, and tags
- model hint
- root/parent topic context

Output:
- `root_topic_id`
- `root_topic_label`
- `primary_topic_id`
- `primary_topic_label`
- `topic_confidence` similarity score
- `topic_candidates` top 3
- `classification_status`
- `classification_method = embedding_similarity`
- `classification_model = baai/bge-m3`

Behavior:
- initial canonical article may be emitted with `classification_status = pending`
- Redis global and country feeds must not wait for classification
- topic feed membership is added after classification completes
- article topic can change on reprocessing
- latest processed result wins
- topic history can be added later if needed
- classification failures set `classification_status = failed` and can be
  retried without duplicating projections

### 9.1 Embedding Service

Spark must not call the NVIDIA embedding API independently from every executor
without global coordination.

Phase 3 uses a centralized internal embedding service that owns:
- batching
- global `40` RPM rate limiting
- NVIDIA API calls
- retry and exponential backoff for `429` and `5xx`
- failed-batch splitting before final failure
- API key isolation
- metrics and request auditing

All NVIDIA settings must be configurable:
- `NVIDIA_API_KEY`
- `NVIDIA_EMBEDDING_BASE_URL`
- `NVIDIA_EMBEDDING_MODEL`
- `NVIDIA_EMBEDDING_BATCH_SIZE`
- `NVIDIA_EMBEDDING_RATE_LIMIT_RPM`
- `NVIDIA_EMBEDDING_TRUNCATE`

Inputs should be validated before sending because `truncate = NONE` must not
silently discard article or topic text.

## 10. Dimensions

Large dimensions are materialized, not queried as raw source tables on every
record.

Strategy:
- keep large dimensions in curated PostgreSQL tables with filtered columns
- use keyed lookups from processor by `link_id`, `authority_id`, `country_id`
- avoid per-row source DB lookups
- allow late-arriving dimension data through retry/pending handling
- emit canonical articles when minimum article fields are valid, even if
  optional dimensions are incomplete

Country resolution:
- primary: `authority.sedition_id -> sedition.pays_id -> pays`
- fallback: `links.pays_id`
- store both `country_id` and `country_name`

Dimension status:
- `complete`
- `partial`
- `pending_required`

Minimum canonical emit fields:
- `article_id`
- `source_news_id`
- `title`
- `url`
- `published_at` or `crawled_at`

Projection eligibility depends on available fields. Global feed requires core
display fields. Country feed requires `country_id`. Topic feeds require
`root_topic_id`.

## 11. Processing Flow

1. Read raw news CDC.
2. Enrich from curated dimension tables.
3. If required minimum fields are missing, mark pending and retry.
4. Clean body, title, URLs, media fields, metadata fields.
5. Build deterministic `excerpt` from cleaned body text.
6. Build initial canonical article with `classification_status = pending`.
7. Upsert cleaned article into PostgreSQL.
8. Emit canonical article event.
9. Redis projector writes eligible feed card and feed indexes.
10. Embedding service batch-embeds article classification input.
11. Classifier compares article embedding to active PostgreSQL topic embeddings.
12. Processor emits updated canonical article with classification fields.
13. Redis projector adds eligible root topic feed membership.
14. Qdrant projector writes article vector and payload.

## 12. Redis Rules

- Redis is recent feed cache and card store only
- use `article_id` as feed member
- use `published_at` as sorted-set score
- keep recent window around 10 days
- do not block Redis on Qdrant
- do not store full body text in Redis
- index root topic feeds only in Phase 3
- remove article card and feed memberships when `is_deleted = true` or
  `is_visible = false`

## 13. Qdrant Rules

- Qdrant stores embedding + filter payload
- Qdrant and Redis are independent consumers
- Qdrant failure must not block Redis
- Redis failure must not block Qdrant
- payload should support country, topic, language, source, date filters
- deleted or hidden articles should be marked with `is_visible = false` in
  Qdrant by default instead of hard-deleted

## 14. Postgres Storage

PostgreSQL stores:
- cleaned durable article record
- dimension projections
- topic taxonomy
- topic embeddings
- classification status and projection state needed for replay-safe cleanup

Use Postgres for:
- fallback reads
- article detail page
- replay/debug
- operational audit

PostgreSQL must keep enough previous projection fields to clean Redis
memberships during updates, deletes, and visibility changes:
- `article_id`
- `country_id`
- `root_topic_id`
- `published_at`
- `is_visible`
- `is_deleted`

## 15. Visibility Rules

Redis eligibility should be partial, not fully strict.

Minimum Redis gate:
- `title` exists
- `url` exists
- `is_visible = true`
- time within recent feed window

Articles missing topic can still appear in global/country feeds.
Topic feed membership is added when classification completes.

Articles with `is_deleted = true` or `is_visible = false` must be removed from
Redis cards and all Redis feed memberships. PostgreSQL keeps the cleaned record
for audit and replay.

## 16. Failure Handling

- missing dimensions -> pending state and retry
- Redis failure -> Qdrant continues
- Qdrant failure -> Redis continues
- classification retry -> latest topic wins
- all writes must be idempotent by `article_id`
- embedding API `429` and `5xx` -> retry with exponential backoff
- repeatedly failing embedding batches -> split into smaller batches before
  marking articles failed
- classification failure -> keep article available in eligible non-topic feeds
  and mark `classification_status = failed`

## 17. Service Design Rules

All Phase 3 services must use dependency injection and depend on abstractions.
Concrete implementations should be wired at application boundaries.

Required abstractions:
- article repositories
- dimension repositories
- topic taxonomy repositories
- topic embedding repositories
- embedding clients
- classification services
- Redis projectors
- Qdrant projectors
- Kafka producers and consumers
- clocks and ID providers
- configuration providers

This allows alternate implementations such as mock repositories, different
embedding providers, different vector stores, or alternate Redis/Qdrant clients
without changing core processing logic.

## 18. Testing Decisions

Good tests validate observable behavior and contracts, not implementation
details.

Required test coverage:
- canonical article builder emits stable schema from raw CDC and dimensions
- excerpt generator produces deterministic first-30-word classification input
  and feed excerpt behavior
- dimension enrichment handles complete, partial, and pending-required states
- topic taxonomy service derives root topic from leaf topic consistently
- topic embedding service regenerates embeddings when taxonomy metadata changes
- embedding gateway batches up to configured size and enforces global rate limit
- classifier returns primary leaf topic, root topic, top 3 candidates, and
  similarity score from article and topic embeddings
- Redis projector writes only eligible feed indexes and removes memberships on
  delete or visibility changes
- Qdrant projector writes vector payload and marks hidden/deleted articles
  invisible
- idempotent replay does not duplicate Postgres, Redis, or Qdrant projections
- service tests use abstractions and test doubles for external systems

Prior test style should follow existing CDC validation and smoke-test patterns:
assert external state, connector status, projection outputs, and replay behavior.

## 19. Success Metrics

- canonical article emitted for every valid news row
- Redis feed latency stays low under Qdrant outage
- Qdrant continues indexing under Redis outage
- topic classification can be updated without duplicates
- article detail reads fall back to Postgres cleanly
- NVIDIA embedding requests respect global `40` RPM
- Spark embedding workload uses batched requests up to configured batch size
- topic embeddings can be refreshed from PostgreSQL taxonomy changes
- service implementations can be swapped through interfaces without modifying
  core processing logic

## 20. Deliverables

- canonical article schema
- topic taxonomy table
- topic embedding table
- canonical processor
- centralized embedding service
- Redis projector
- Qdrant projector
- cleaned article table
- operational notes for late dimensions and retries
- dependency-injection interfaces for processors, projectors, repositories,
  embedding clients, classifiers, and storage adapters

## 21. Ubiquitous Language

Canonical domain terms are maintained in `UBIQUITOUS_LANGUAGE.md`. The PRD
should use those terms consistently, especially for canonical article, cleaned
article, feed card, root topic, primary topic, topic embedding, article
embedding, projection, projector, and visibility.
