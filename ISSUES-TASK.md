# Phase 3 Issue Task Ledger

Source of truth:
- PRD: `docs/product/phase-3-processing-canonical-article-prd.md`
- GitHub parent issue: `#13` PRD: Phase 3 canonical article processing and serving projections
- Working branch: `phase-3-processing`

Usage:
- Mark an issue complete only after implementation and verification pass.
- Keep partial work unchecked.
- Add notes for completed steps, issues faced, and how they were solved.
- Refresh live GitHub issue bodies before starting a new implementation session.

## Issue Dependency Order

- [x] `#14` Phase 3: Canonical article first emit
  - Status: Completed on 2026-04-25.
  - Related issues: unlocks `#15`, `#16`, `#19`, `#21`, and `#23`.
  - Notes: Implemented the first Python/Spark tracer bullet from CDC-like `table_news` input to a canonical article event and cleaned PostgreSQL upsert contract.
  - Files changed:
    - `apps/processing/news-pipeline/README.md`
    - `apps/processing/news-pipeline/jobs/canonical_article_first_emit.py`
    - `apps/processing/news-pipeline/src/imperium_news_pipeline/__init__.py`
    - `apps/processing/news-pipeline/src/imperium_news_pipeline/phase3/__init__.py`
    - `apps/processing/news-pipeline/src/imperium_news_pipeline/phase3/canonical.py`
    - `apps/processing/news-pipeline/src/imperium_news_pipeline/phase3/postgres.py`
    - `infrastructure/postgres/phase3/01_cleaned_articles.sql`
    - `tests/processing/test_canonical_article_first_emit.py`
  - Acceptance evidence:
    - Deterministic `article_id` implemented as `news:{source_news_id}` by `NewsArticleIdProvider`.
    - `RawNewsRecord` preserves `source_news_id` from `table_news.id`.
    - `CanonicalArticle` includes core display, visibility, schema version, and `processed_at` fields.
    - Initial canonical events use `classification_status=pending`.
    - `CleanedArticleRepository`, `CanonicalArticleProducer`, `Clock`, and `ArticleIdProvider` are abstractions used by the processor.
    - `PostgresCleanedArticleRepository` implements the cleaned-record upsert behind the repository abstraction.
    - `phase3_cleaned_articles` DDL stores one row per `article_id`; the repository upsert uses `ON CONFLICT (article_id)`.
    - Replay behavior is covered by an in-memory repository test: identical input converges on one cleaned row and does not re-emit.
  - Verification:
    - `PYTHONPATH=apps/processing/news-pipeline/src python3 -m unittest discover -s tests/processing -p 'test_*.py'` -> passed, 4 tests.
    - `python3 -m compileall apps/processing/news-pipeline/src apps/processing/news-pipeline/jobs tests/processing` -> passed.
  - Issues faced:
    - Initially started toward the Java backend because it was the only populated app module. User corrected that Phase 3 processing should use Spark and Python.
    - `pytest` was not installed in the environment.
  - Solutions:
    - Removed the empty Java Phase 3 directories and implemented under `apps/processing/news-pipeline`.
    - Converted tests to standard-library `unittest` so the slice can be verified without adding dependencies.
  - Follow-ups:
    - Concrete Kafka producer wiring is still deployment-boundary work. The `#14` core contracts and PostgreSQL repository adapter are ready for the next Spark integration slice.
    - Runtime submission should use one dedicated Spark driver container per long-running Phase 3 job, with separate env, logs, restart policy, and checkpoint location per job.

- [ ] `#17` Phase 3: Topic taxonomy and topic embeddings
  - Status: Partially implemented on 2026-04-25; awaiting human review of seed taxonomy content before completion.
  - Related issues: pairs naturally with `#18` for later `#19`.
  - Notes: Independent root slice for taxonomy schema, seed content, embedding storage, and human review.
  - Progress notes:
    - Implemented `imperium_news_pipeline.phase3.topics` with topic taxonomy entities, root/leaf derivation, deterministic embedding input text, input hashing, regeneration checks, active embedding repository contracts, and a small draft `phase3-v1` seed taxonomy.
    - Added PostgreSQL DDL for `phase3_topic_taxonomy` and `phase3_topic_embeddings`, including hierarchy, multilingual metadata JSON, `model_hint`, `taxonomy_version`, active state, and `review_status`.
    - Added tests for root and primary topic behavior, multilingual embedding input construction, metadata/model/version regeneration decisions, active embedding loading for classifiers, and glossary-aligned record fields.
    - Updated `apps/processing/news-pipeline/README.md` with taxonomy and embedding storage notes.
  - Verification:
    - `PYTHONPATH=apps/processing/news-pipeline/src python3 -m unittest discover -s tests/processing -p 'test_*.py'` -> passed, 9 tests.
    - `python3 -m compileall apps/processing/news-pipeline/src apps/processing/news-pipeline/jobs tests/processing` -> passed.
  - Remaining incomplete acceptance criteria:
    - Human review must confirm taxonomy seed content before broad use.

- [ ] `#18` Phase 3: Central embedding gateway
  - Status: Not started.
  - Related issues: pairs naturally with `#17`; unlocks `#19` and `#21`.
  - Notes: Independent root slice for provider abstraction, batching, 40 RPM rate limit, retries, and metrics.

- [x] `#15` Phase 3: Spark dimension materialization with partial eligibility
  - Status: Completed on 2026-04-25.
  - Related issues: supports `#16` and `#23`.
  - Notes: Implemented Spark Structured Streaming dimension materialization boundary, curated dimension domain projection, inactive deletes, compacted-event publishing abstraction, enrichment lookup, and partial eligibility integration with canonical article processing.
  - Files changed:
    - `apps/processing/news-pipeline/README.md`
    - `apps/processing/news-pipeline/jobs/dimension_materialization.py`
    - `apps/processing/news-pipeline/src/imperium_news_pipeline/phase3/canonical.py`
    - `apps/processing/news-pipeline/src/imperium_news_pipeline/phase3/dimensions.py`
    - `infrastructure/postgres/phase3/03_curated_dimensions.sql`
    - `tests/processing/test_phase3_dimensions_and_redis.py`
  - Acceptance evidence:
    - Spark job boundary consumes links, authority, sedition, country, rubric, and language CDC topics from env-configured Kafka topics.
    - Curated records store filtered fields only; irrelevant raw fields are discarded in tests.
    - Optional compacted dimension publication is modeled by `DimensionEventProducer` and key format `{dimension_type}:{dimension_id}`.
    - Curated projection is owned by `DimensionMaterializer`; sink connectors remain outside this ownership boundary.
    - Country resolution prefers `authority.sedition_id -> sedition.country_id -> countries` and falls back to `links.country_id`.
    - Deletes become inactive curated records; inactive dimensions are not returned for enrichment.
    - Writes are idempotent by dimension type and dimension ID.
    - Canonical processing uses `DimensionEnrichmentService`, keeps minimum-field failures as `pending_required`, and emits visible partial articles when optional dimensions are missing.
    - Projection eligibility fields now derive from available curated country/source/rubric fields.
  - Verification:
    - `PYTHONPATH=apps/processing/news-pipeline/src python3 -m unittest discover -s tests/processing -p 'test_*.py'` -> passed, 15 tests.
    - `python3 -m compileall apps/processing/news-pipeline/src apps/processing/news-pipeline/jobs tests/processing` -> passed.
  - Issues faced:
    - Runtime PostgreSQL/Kafka adapters are deployment-boundary work, matching the existing #14 pattern.
  - Solutions:
    - Kept core projection and enrichment behavior testable through repository, producer, and Spark micro-batch abstractions.

- [x] `#16` Phase 3: Redis feed card projection
  - Status: Completed on 2026-04-25.
  - Related issues: supports `#20`, `#22`, and `#23`.
  - Notes: Implemented independent Redis feed-card projector for classification-pending canonical articles.
  - Files changed:
    - `apps/processing/news-pipeline/README.md`
    - `apps/processing/news-pipeline/src/imperium_news_pipeline/phase3/redis_projection.py`
    - `tests/processing/test_phase3_dimensions_and_redis.py`
  - Acceptance evidence:
    - `article:{article_id}` stores compact feed card fields only.
    - `feed:global` stores `article_id` members scored by `published_at` or `crawled_at`.
    - `feed:country:{country_id}` is written only when `country_id` exists.
    - Full body text is excluded from Redis cards.
    - Hidden or deleted articles remove the card plus global, country, and known topic feed memberships.
    - Redis client failures are captured in `RedisProjectionResult.errors` instead of propagating through the caller.
    - Projector depends on a Redis client abstraction and is covered by observable in-memory Redis state tests.
  - Verification:
    - `PYTHONPATH=apps/processing/news-pipeline/src python3 -m unittest discover -s tests/processing -p 'test_*.py'` -> passed, 15 tests.
    - `python3 -m compileall apps/processing/news-pipeline/src apps/processing/news-pipeline/jobs tests/processing` -> passed.
  - Follow-ups:
    - Root-topic feed membership remains in `#20` after classification.

- [ ] `#19` Phase 3: Embedding similarity classification
  - Status: Blocked by `#17` and `#18`.
  - Related issues: supports `#20`, `#21`, and `#23`.
  - Notes: Classifies by title plus first 30 cleaned body words against active PostgreSQL topic embeddings.

- [ ] `#20` Phase 3: Redis root topic feed updates
  - Status: Blocked by `#16` and `#19`.
  - Related issues: supports `#22` and `#23`.
  - Notes: Root-topic and country-root-topic Redis feed membership after classification.

- [ ] `#21` Phase 3: Qdrant vector projection
  - Status: Blocked by `#18` and `#19`.
  - Related issues: supports `#22` and `#23`.
  - Notes: Independent Qdrant projection with vector payload filters and visibility updates.

- [ ] `#22` Phase 3: Replay-safe projection state
  - Status: Blocked by `#16`, `#20`, and `#21`.
  - Related issues: supports `#23`.
  - Notes: Persist previous projection fields for idempotent replay and safe Redis/Qdrant cleanup.

- [ ] `#23` Phase 3: End-to-end validation
  - Status: Blocked by `#14`, `#15`, `#16`, `#17`, `#18`, `#19`, `#20`, `#21`, and `#22`.
  - Related issues: final validation issue.
  - Notes: Full flow from CDC-like inputs through cleaned PostgreSQL, Redis, classification, Qdrant, replay, delete, and pass/fail reporting.

## Session Notes

### 2026-04-25 - Setup

- Created branch `phase-3-processing`.
- Created this Phase 3 issue ledger.
- Created the `imperium-phase3-issue-runner` skill for future sessions.
- Live GitHub issues read: `#13` through `#23`, all open at setup time.
- Initial recommended implementation choices:
  - Start with `#14` alone for the first canonical article tracer bullet.
  - `#17` and `#18` can be worked independently if a session should avoid waiting on `#14`.
