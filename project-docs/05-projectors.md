# 05 - Serving Projectors & Data Synchronization

## 1. Decoupled Projection Design

Rather than writing to PostgreSQL, Redis, Qdrant, and Elasticsearch synchronously from the core Spark stream-processing job (which would slow down the pipeline and couple the system to the slowest database), the platform implements a **Decoupled Projection Design**. 

Spark emits a single, normalized representation of the article (the **Canonical Article**) onto the Kafka topic `phase3.canonical-articles`. Independent, Python-based worker processes—known as **Projectors**—consume this topic asynchronously and project the records into their respective target databases.

```
                               ┌───────────────────┐
                               │ Canonical Article │
                               │    Kafka Topic    │
                               └─────────┬─────────┘
                                         │
                 ┌───────────────────────┼───────────────────────┐
                 ▼                       ▼                       ▼
      ┌────────────────────┐   ┌────────────────────┐   ┌────────────────────┐
      │   Redis Projector  │   │  Qdrant Projector  │   │ Postgres Projector │
      └──────────┬─────────┘   └──────────┬─────────┘   └──────────┬─────────┘
                 │                        │                        │
                 ▼                        ▼                        ▼
           Redis Memory           Qdrant Vectors           Postgres Table
         (Feeds & Cards)        (Semantic Index)         (System of Record)
```

### Advantages of the Decoupled Approach
*   **Independent Scaling:** If search queries surge, the Qdrant projector and vector index can be scaled out without impacting the core Spark job or Redis feed writes.
*   **Fault Isolation:** If Qdrant goes offline due to a cluster issue, the Qdrant projector will fail, but the Redis projector continues uninterrupted, keeping the user feeds fresh.
*   **Target Optimization:** Each projector can batch write operations using database-specific drivers (e.g. Redis pipeline, Elasticsearch bulk API).

---

## 2. Redis Projector (`redis_projector.py`)

The Redis projector is responsible for keeping the read-optimized feed caches synchronized.

### Operational Routine
When the projector receives a canonical article event:
1.  **Validity Filter:** It verifies that the article is visible (`is_visible = true`) and not deleted (`is_deleted = false`).
2.  **Write Feed Card:** Denormalizes the card fields and writes them as a Redis HASH with key `article:{article_id}`. A TTL of 10 days is set on this key.
3.  **Insert Feed Indexes (ZSETs):**
    *   Adds the `article_id` to `feed:global` scored by the publication timestamp (`published_at` epoch).
    *   Adds to `feed:country:{country_id}` if the country is resolved.
    *   If `classification_status` is `classified`, it looks up the taxonomy to resolve the **Root Topic** and adds the ID to `feed:topic:{root_topic_id}` and `feed:country:{country_id}:topic:{root_topic_id}`.
4.  **Transaction Pipelining:** All operations for a single article are bundled into a Redis pipeline to minimize network roundtrips.

---

## 3. PostgreSQL Projector (`postgres_projector.py`)

The PostgreSQL projector writes the canonical article into the durable store of record.

### Operational Routine
*   **Idempotent Upsert:** When a canonical article is consumed, the projector performs an `INSERT ... ON CONFLICT (article_id) DO UPDATE` query against the `phase3_cleaned_articles` table.
*   **Replay Safety:** Because it is keyed by `article_id` (a deterministic string generated from the source news ID), replaying Kafka messages from the past will simply overwrite existing records, maintaining exact idempotency.
*   **Schema Mapping:** Maps the flat Avro message structure to the structured columns of the relational database table.

---

## 4. Qdrant Projector (`qdrant_projector.py`)

The Qdrant projector synchronizes vector representation and filtering payloads.

### Operational Routine
*   **Validation:** Checks if the article contains a valid vector embedding (3584 floats). If the classification status is `pending` or `failed`, the vector is missing and the projector skips Qdrant indexing until the classifier updates the record.
*   **Upsert Point:** Packs the embedding vector and payload fields into a Qdrant `PointStruct` and sends it to the `imperium_articles` collection.
*   **Payload Filtering:** Includes keys like `country_id`, `root_topic_id`, `language_id`, and `is_visible` inside the payload to enable fast hybrid search filtering.

---

## 5. Deletion & Visibility Propagation Rules

When an editor hides an article or a crawler deletes a source record, these state mutations must propagate instantly to all serving caches. The platform achieves this via the following propagation pipeline:

### Event Trigger
A DELETE or UPDATE event in the source database is captured by Debezium and published to Kafka. Spark translates it into a Canonical Article with `is_deleted = true` or `is_visible = false`.

### Projector Actions
1.  **Redis Projector:**
    *   Executes `DEL article:{article_id}` to delete the card cache.
    *   Queries `phase3_projection_state` or extracts current IDs to run `ZREM` on the global, country, and topic feeds to remove the article ID from all indexes.
2.  **Qdrant Projector:**
    *   Rather than hard-deleting the vector point (which causes indexing overhead), it performs a **Soft Delete** by updating the vector payload to `is_visible = false`. All semantic search endpoints filter out records where `is_visible` is false.
3.  **Elasticsearch Projector:**
    *   Updates the document to set `is_visible = false` or removes it from the search index.
4.  **Postgres Projector:**
    *   Updates the durable record's state to match the deletion or hidden flags.
