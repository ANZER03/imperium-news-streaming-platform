# Phase 3 PRD

## Imperium Processing Phase - Canonical Article, Topic Taxonomy, and Serving Projections

## 1. Overview

This phase turns raw CDC streams into a product-ready article model and
separates serving concerns from processing concerns.

Goal:
- build one canonical article contract
- enrich news with large dimensions without blocking the system
- classify articles into business topics with model-only classification
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

## 4. In Scope

- canonical article schema design
- topic taxonomy schema and classification flow
- model-only topic classification
- deterministic excerpt generation
- dimension projection for large tables
- Redis feed projection
- Qdrant vector projection
- Postgres cleaned article storage
- replay-safe upsert behavior

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
Processor emits canonical article.
Redis and Qdrant consume canonical article independently.

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
- `topic_id`
- `topic_label`
- `primary_topic_id`
- `primary_topic_label`
- `topic_confidence`
- `topic_candidates`
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
- `classification_model`
- `classified_at`
- `schema_version`
- `processed_at`

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
- `primary_topic_id`
- `primary_topic_label`
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
- `feed:topic:{primary_topic_id}`
- `feed:country:{country_id}:topic:{primary_topic_id}`

### 7.3 Qdrant Payload

Qdrant stores:
- vector embedding
- payload filters

Payload fields:
- `article_id`
- `country_id`
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
- `is_active`
- `model_hint`
- `created_at`
- `updated_at`

Rules:
- one primary leaf topic per article
- optional secondary topics for debug and search
- topic taxonomy is source of truth in PostgreSQL
- topic descriptions and tags are fed into classification input

## 9. Classification

Classification is model-only.

Input:
- `title`
- `excerpt`
- `body_text_clean`
- source context
- topic taxonomy description and tags

Output:
- `primary_topic_id`
- `primary_topic_label`
- `topic_confidence`
- `topic_candidates` top 3

Behavior:
- article topic can change on reprocessing
- latest processed result wins
- topic history can be added later if needed

## 10. Dimensions

Large dimensions are materialized, not queried as raw source tables on every
record.

Strategy:
- keep large dimensions in curated PostgreSQL tables with filtered columns
- use keyed lookups from processor by `link_id`, `authority_id`, `country_id`
- avoid per-row source DB lookups
- allow late-arriving dimension data through retry/pending handling

Country resolution:
- primary: `authority.sedition_id -> sedition.pays_id -> pays`
- fallback: `links.pays_id`
- store both `country_id` and `country_name`

## 11. Processing Flow

1. Read raw news CDC.
2. Enrich from curated dimension tables.
3. If required dimensions missing, mark pending and retry.
4. Clean body, title, URLs, media fields, metadata fields.
5. Build deterministic `excerpt` from cleaned body text.
6. Run model-only topic classification.
7. Build canonical article.
8. Upsert cleaned article into PostgreSQL.
9. Emit canonical article event.
10. Redis projector writes feed card and feed indexes.
11. Qdrant projector writes vector and payload.

## 12. Redis Rules

- Redis is recent feed cache and card store only
- use `article_id` as feed member
- use `published_at` as sorted-set score
- keep recent window around 10 days
- do not block Redis on Qdrant
- do not store full body text in Redis

## 13. Qdrant Rules

- Qdrant stores embedding + filter payload
- Qdrant and Redis are independent consumers
- Qdrant failure must not block Redis
- Redis failure must not block Qdrant
- payload should support country, topic, language, source, date filters

## 14. Postgres Storage

PostgreSQL stores:
- cleaned durable article record
- dimension projections
- topic taxonomy

Use Postgres for:
- fallback reads
- article detail page
- replay/debug
- operational audit

## 15. Visibility Rules

Redis eligibility should be partial, not fully strict.

Minimum Redis gate:
- `title` exists
- `url` exists
- `is_visible = true`
- time within recent feed window

Articles missing topic can still appear in global/country feeds.
Topic feed membership is added when classification completes.

## 16. Failure Handling

- missing dimensions -> pending state and retry
- Redis failure -> Qdrant continues
- Qdrant failure -> Redis continues
- classification retry -> latest topic wins
- all writes must be idempotent by `article_id`

## 17. Success Metrics

- canonical article emitted for every valid news row
- Redis feed latency stays low under Qdrant outage
- Qdrant continues indexing under Redis outage
- topic classification can be updated without duplicates
- article detail reads fall back to Postgres cleanly

## 18. Deliverables

- canonical article schema
- topic taxonomy table
- canonical processor
- Redis projector
- Qdrant projector
- cleaned article table
- operational notes for late dimensions and retries

