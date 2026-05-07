# Processing Stage: Enrichment & AI Classification

The Processing Stage reads Avro CDC events from Kafka, transforms them into enriched and classified `CanonicalArticle` records, and fans the results out to PostgreSQL, Redis, and Qdrant via 6 dedicated Spark streaming jobs.

![Processing Stage Architecture Diagram](../assets/processing_arch.svg)

**Data enters** as Avro CDC envelopes from `imperium.news.public.*` Kafka topics.  
**Data leaves** via: (1) PostgreSQL `imperium_articles` table, (2) `imperium.canonical-articles` Kafka topic, (3) direct Redis writes, (4) direct Qdrant writes.

← Previous stage: [Ingestion](../ingestion/README.md) — produces the CDC envelopes consumed here.  
→ Next stage: [Storage](../storage/README.md) — documents the Redis and Qdrant key schemas written here.

---

## Architecture & Flow

```mermaid
flowchart TD
    subgraph KAFKA_IN["Kafka Inputs"]
        T_DIM["imperium.news.public.<dim_table>\nAvro CDC envelope"]
        T_NEWS["imperium.news.public.table_news\nAvro CDC envelope"]
        T_CAN["imperium.canonical-articles\nJSON CanonicalArticle"]
    end

    subgraph SPARK["Spark 3.5.3 — 6 Runtime Jobs (each in its own driver container)"]
        direction TB
        JOB_DIM["phase3_dimension_materializer_runtime\nDimension Materialization — trigger: 15s"]
        JOB_CAN["phase3_canonical_pending_runtime\nCanonical Article Emit — trigger: 5s"]
        JOB_CLS["phase3_classification_runtime\nEmbedding Classification — trigger: 15s"]
        JOB_RP["phase3_redis_pending_projector\nRedis Pending Feed — trigger: 15s"]
        JOB_RT["phase3_redis_topics_projector\nRedis Topics Feed — trigger: 15s"]
        JOB_QD["phase3_qdrant_projector_runtime\nQdrant Vector Upsert — trigger: 15s"]
    end

    subgraph PG["PostgreSQL Storage"]
        DIM_TBL["imperium_dim_links\nimperium_dim_authorities\nimperium_dim_seditions\nimperium_dim_countries\nimperium_dim_rubrics\nimperium_dim_languages"]
        ART_TBL["imperium_articles\nclassification_status:\nenriched | classified | failed"]
        TAX_TBL["imperium_topic_taxonomy\n(Medtop topic tree)"]
        EMB_TBL["imperium_topic_embeddings\n(SHA-256 hashed, regenerated on change)"]
        PROJ_TBL["imperium_projection_state\narticle_id, country_id, root_topic_id"]
    end

    subgraph AI["Embedding Gateway"]
        GW["embedding_gateway.py\nbatch up to 8191 items\n40 RPM sliding-window throttle\nexponential backoff + bisect retry"]
        NV["NVIDIA API\nbaai/bge-m3 model\nreturns float32[1024]"]
    end

    subgraph OUT["Outputs"]
        REDIS[("Redis\nfeed ZSETs + article hashes")]
        QDRANT[("Qdrant\nimperium_articles collection")]
        T_CAN_OUT["imperium.canonical-articles\n(status=enriched or classified)"]
        T_DLQ["imperium.canonical-articles.dlq\n(empty title/body)"]
    end

    T_DIM -->|"readStream\nAvro decode via cdc.py + spark_cdc.py\nschema fetched from Karapace"| JOB_DIM
    T_NEWS -->|"readStream\nAvro decode\n5-day MVP window filter"| JOB_CAN

    JOB_DIM -->|"UPSERT\n(is_active=False on delete op)"| DIM_TBL

    JOB_CAN -->|"snapshot_for_many()\nresolves country via authority→sedition chain"| DIM_TBL
    JOB_CAN -->|"UPSERT status=enriched\nonly if payload changed (idempotent)"| ART_TBL
    JOB_CAN -->|"CanonicalArticle JSON\nclassification_status=enriched\nroot_topic_id=None"| T_CAN_OUT
    JOB_CAN -.->|"articles with empty title or body"| T_DLQ

    T_CAN -->|"filter status=enriched\nreadStream"| JOB_CLS
    TAX_TBL -.->|"load taxonomy at startup\nTopicTaxonomyService"| JOB_CLS
    EMB_TBL -.->|"load topic vectors at startup"| JOB_CLS

    JOB_CLS -->|"embed(title + first 30 body words)"| GW
    GW -->|"POST /v1/embeddings (batched)"| NV
    NV -->|"float32[1024] per item"| GW
    GW -->|"EmbeddingGatewayResult"| JOB_CLS

    JOB_CLS -->|"cosine_sim(article_vec, topic_vecs)\nassign primary_topic, root_topic\nUPDATE status=classified"| ART_TBL
    JOB_CLS -->|"CanonicalArticle JSON\nstatus=classified\n+ embedding float32[1024]"| T_CAN_OUT

    T_CAN_OUT -->|"filter status=enriched"| JOB_RP
    T_CAN_OUT -->|"filter status=classified"| JOB_RT
    T_CAN_OUT -->|"filter status=classified"| JOB_QD

    JOB_RP -->|"HSET news:{id} card fields\nZADD feed:global (score=published_at)\nZADD feed:country:{id}"| REDIS
    JOB_RT -->|"ZADD feed:topic:{root_id}\nZADD feed:country:{c}:topic:{t}\nZREM stale memberships on reclassification"| REDIS
    JOB_RT <-->|"SELECT prev state\nUPSERT new state\n(replay-safe skip if unchanged)"| PROJ_TBL
    JOB_QD -->|"upsert Qdrant point\n{id=source_news_id, vector[1024], payload}"| QDRANT
```

---

## Sub-Stage Breakdown

| Job | Entry Point | Core Modules | Input Topic / Source | Output |
|---|---|---|---|---|
| **Dimension Materialization** | [`phase3_dimension_materializer_runtime.py`](../../../apps/processing/news-pipeline/jobs/phase3_dimension_materializer_runtime.py) | [`dimensions.py`](../../../apps/processing/news-pipeline/src/imperium_news_pipeline/phase3/dimensions.py), [`dimension_runtime_jobs.py`](../../../apps/processing/news-pipeline/src/imperium_news_pipeline/phase3/dimension_runtime_jobs.py) | `imperium.news.public.<dim_table>` | `imperium_dim_*` PostgreSQL tables |
| **Canonical Article Emit** | [`phase3_canonical_pending_runtime.py`](../../../apps/processing/news-pipeline/jobs/phase3_canonical_pending_runtime.py) | [`canonical.py`](../../../apps/processing/news-pipeline/src/imperium_news_pipeline/phase3/canonical.py), [`pending_feed_runtime.py`](../../../apps/processing/news-pipeline/src/imperium_news_pipeline/phase3/pending_feed_runtime.py) | `imperium.news.public.table_news` | `imperium_articles` (status=enriched) + `imperium.canonical-articles` Kafka topic |
| **Embedding Classification** | [`phase3_classification_runtime.py`](../../../apps/processing/news-pipeline/jobs/phase3_classification_runtime.py) | [`classification.py`](../../../apps/processing/news-pipeline/src/imperium_news_pipeline/phase3/classification.py), [`embedding_gateway.py`](../../../apps/processing/news-pipeline/src/imperium_news_pipeline/phase3/embedding_gateway.py) | `imperium.canonical-articles` (enriched) | `imperium_articles` (status=classified) + re-emits to canonical topic |
| **Redis Pending Projector** | [`phase3_redis_pending_projector.py`](../../../apps/processing/news-pipeline/jobs/phase3_redis_pending_projector.py) | [`redis_projection.py`](../../../apps/processing/news-pipeline/src/imperium_news_pipeline/phase3/redis_projection.py) | `imperium.canonical-articles` (enriched) | Redis: `news:{id}` hash, `feed:global`, `feed:country:{id}` ZSETs |
| **Redis Topics Projector** | [`phase3_redis_topics_projector.py`](../../../apps/processing/news-pipeline/jobs/phase3_redis_topics_projector.py) | [`redis_projection.py`](../../../apps/processing/news-pipeline/src/imperium_news_pipeline/phase3/redis_projection.py), [`projection_fanout.py`](../../../apps/processing/news-pipeline/src/imperium_news_pipeline/phase3/projection_fanout.py) | `imperium.canonical-articles` (classified) | Redis: `feed:topic:{root_id}`, `feed:country:{c}:topic:{t}` ZSETs |
| **Qdrant Projector** | [`phase3_qdrant_projector_runtime.py`](../../../apps/processing/news-pipeline/jobs/phase3_qdrant_projector_runtime.py) | [`qdrant_projection.py`](../../../apps/processing/news-pipeline/src/imperium_news_pipeline/phase3/qdrant_projection.py) | `imperium.canonical-articles` (classified) | Qdrant `imperium_articles` collection |

---

## Key Source Files

| File | Description |
|---|---|
| [`phase3/cdc.py`](../../../apps/processing/news-pipeline/src/imperium_news_pipeline/phase3/cdc.py) | `CdcEnvelope` dataclass; parses Debezium `before/after/op/source` fields |
| [`phase3/spark_cdc.py`](../../../apps/processing/news-pipeline/src/imperium_news_pipeline/phase3/spark_cdc.py) | Spark UDF wrappers; strips 5-byte Confluent wire format header before Avro decode |
| [`phase3/schema_registry.py`](../../../apps/processing/news-pipeline/src/imperium_news_pipeline/phase3/schema_registry.py) | HTTP client for Karapace; fetches Avro schema by `schema_id` |
| [`phase3/canonical.py`](../../../apps/processing/news-pipeline/src/imperium_news_pipeline/phase3/canonical.py) | `CanonicalArticle` dataclass; `CLASSIFICATION_STATUS_*` constants; `RawNewsRecord` |
| [`phase3/pending_feed_runtime.py`](../../../apps/processing/news-pipeline/src/imperium_news_pipeline/phase3/pending_feed_runtime.py) | `PendingCanonicalFeedRuntime`; orchestrates enrichment, PG upsert, Kafka emit, Redis write |
| [`phase3/classification.py`](../../../apps/processing/news-pipeline/src/imperium_news_pipeline/phase3/classification.py) | `EmbeddingSimilarityClassifier`; cosine-sim against `TopicTaxonomyService`; traverses `parent_topic_id` chain for root topic |
| [`phase3/embedding_gateway.py`](../../../apps/processing/news-pipeline/src/imperium_news_pipeline/phase3/embedding_gateway.py) | `EmbeddingGateway`; 40 RPM `InMemoryRateLimiter`; exponential backoff; bisect retry on partial failure |
| [`phase3/redis_projection.py`](../../../apps/processing/news-pipeline/src/imperium_news_pipeline/phase3/redis_projection.py) | `RedisFeedProjector`; writes `news:{id}` hash + all feed ZSETs |
| [`phase3/qdrant_projection.py`](../../../apps/processing/news-pipeline/src/imperium_news_pipeline/phase3/qdrant_projection.py) | `QdrantArticleProjector`; builds Qdrant `PointStruct` with 1024-dim vector + payload |
| [`phase3/projection_fanout.py`](../../../apps/processing/news-pipeline/src/imperium_news_pipeline/phase3/projection_fanout.py) | `ProjectionFanout`; orchestrates Redis + Qdrant projectors; skips exact replays via `ProjectionState` |
| [`phase3/projection_state.py`](../../../apps/processing/news-pipeline/src/imperium_news_pipeline/phase3/projection_state.py) | `ProjectionStateRepository`; PostgreSQL-backed; stores `(article_id, country_id, root_topic_id)` for cleanup on reclassification |
| [`phase3/runtime_config.py`](../../../apps/processing/news-pipeline/src/imperium_news_pipeline/phase3/runtime_config.py) | `Phase3RuntimeConfig.from_env()`; reads all service coordinates from env vars; builds Spark session |
| [`phase3/topics.py`](../../../apps/processing/news-pipeline/src/imperium_news_pipeline/phase3/topics.py) | `TopicEmbeddingInputBuilder`; SHA-256 hash guards; `TopicTaxonomyService.root_for_leaf()` |
| [`resources/news_topic_taxonomy_medtop_en_us.json`](../../../apps/processing/news-pipeline/resources/news_topic_taxonomy_medtop_en_us.json) | Medtop topic taxonomy loaded at startup; source for topic embeddings |
| [`resources/schema/imperium_news_articles.sql`](../../../apps/processing/news-pipeline/resources/schema/imperium_news_articles.sql) | DDL for all `imperium_*` PostgreSQL tables |

---

## Key Environment Variables

All wiring is read by [`runtime_config.py`](../../../apps/processing/news-pipeline/src/imperium_news_pipeline/phase3/runtime_config.py) via `Phase3RuntimeConfig.from_env()`:

| Variable | Default | Purpose |
|---|---|---|
| `KAFKA_BOOTSTRAP_SERVERS` | `localhost:49092` | Kafka broker address |
| `SCHEMA_REGISTRY_URL` | `http://localhost:8081` | Karapace endpoint |
| `POSTGRES_DSN` | `postgresql://postgres:postgres@localhost:35432/imperium-news-source` | PostgreSQL connection |
| `REDIS_URL` | `redis://localhost:46379/0` | Redis connection |
| `QDRANT_URL` | `http://localhost:46333` | Qdrant HTTP endpoint |
| `QDRANT_COLLECTION` | `imperium_articles` | Qdrant collection name |
| `QDRANT_VECTOR_SIZE` | `1024` | Must match embedding model output dimension |
| `NVIDIA_API_BASE_URL` | — | NVIDIA embedding API base URL |
| `NVIDIA_API_KEY` | — | NVIDIA API authentication key |
| `NVIDIA_EMBEDDING_MODEL` | `baai/bge-m3` | Embedding model name |
| `EMBEDDING_BATCH_SIZE` | `8191` | Max items per embedding API call |
| `EMBEDDING_RPM` | `40` | Rate limit (requests per minute) |
| `WINDOW_DAYS` | `5` | MVP window; articles older than N days are filtered out |

Per-job overrides use the pattern `{JOB_NAME_UPPER}_{KEY_SUFFIX}`.

---

## Data Lifecycle: `classification_status`

The `classification_status` field on `CanonicalArticle` is the state machine that drives all downstream routing:

```
table_news CDC
      ↓
  CanonicalArticle
  status = "enriched"     ← written by Canonical Emit job
      ↓                     triggers Redis Pending Projector (feed:global, feed:country)
  status = "classified"   ← written by Classification job
      ↓                     triggers Redis Topics Projector + Qdrant Projector
  status = "failed"       ← classification could not complete (embedding API error, etc.)
```

On **reclassification** (e.g. when the topic taxonomy changes), the Redis Topics Projector reads the prior `ProjectionState` from PostgreSQL to remove stale ZSET memberships before writing new ones. This prevents phantom entries in topic feeds.

---

## Reliability

- **Checkpointing**: Each Spark job maintains its own checkpoint dir in a shared volume — enables seamless restart and exactly-once processing where Kafka guarantees allow.
- **Driver Isolation**: Each of the 6 jobs runs in a dedicated container. A failure in one projector does not affect others.
- **Replayability**: Restart any job from an earlier Kafka offset to reprocess data. `ProjectionState` ensures idempotent output.
- **DLQ**: Articles with missing `title` or `body` are routed to `imperium.canonical-articles.dlq` for manual inspection.
- **Embedding bisect retry**: On batch embedding failure, `EmbeddingGateway` recursively bisects the batch to isolate the single failing item without discarding the rest.
