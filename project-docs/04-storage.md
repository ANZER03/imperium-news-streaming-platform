# 04 - Multi-Engine Storage Architecture

To achieve low-latency serving while maintaining transaction safety, data durability, and semantic retrieval capabilities, the platform implements a **Multi-Engine Storage Architecture**. Concerns are split across relational, cache, vector, and search engines.

---

## 1. Storage Engines & System Roles

The platform utilizes four storage engines, each optimized for specific query patterns and access requirements:

| Engine | Storage Type | System Role | Primary Key/Key Pattern |
|---|---|---|---|
| **PostgreSQL** (CNPG) | Relational (Transactional) | System of Record. Stores clean articles, taxonomies, dimensions, and projection states. | `article_id` (PK, string) |
| **Redis** | In-Memory (Key-Value/ZSET) | Low-Latency Serving Cache. Serves global, country, and topic feeds. | `article:{article_id}`, `feed:{scope}` |
| **Qdrant** | Vector Database | Semantic Retrieval Layer. Indexes embeddings for similarity and hybrid searches. | Vector Payload + ID (UUID) |
| **Elasticsearch** | Text Search Index | Keyword search and advanced boolean filtering. | `article_id` (document ID) |

---

## 2. PostgreSQL Schema Design (System of Record)

PostgreSQL is deployed in a high-availability cluster managed by the **CloudNativePG (CNPG)** operator. It maintains long-term durability and relational integrity.

### Curated Schema Architecture (Phase 3)
*   **`phase3_cleaned_articles` (Table):** Stored target for enriched news articles.
    *   `article_id` (text, Primary Key)
    *   `source_news_id` (bigint)
    *   `title`, `url` (text)
    *   `body_text`, `body_text_clean` (text)
    *   `excerpt`, `image_url`, `video_url` (text)
    *   `reporter` (text)
    *   `published_at`, `crawled_at`, `processed_at` (timestamp with time zone)
    *   `country_id` (integer), `country_name` (text)
    *   `source_name` (text), `source_domain` (text)
    *   `rubric_id` (integer), `rubric_title` (text)
    *   `primary_topic_id` (text), `root_topic_id` (text)
    *   `topic_confidence` (double precision)
    *   `classification_status` (text)
    *   `is_visible`, `is_deleted` (boolean)
*   **Curated Dimension Tables:** `phase3_dim_links`, `phase3_dim_authorities`, `phase3_dim_countries`, `phase3_dim_rubrics`, `phase3_dim_languages`, `phase3_dim_seditions`. These store reference metadata captured by the dimension materializer job.
*   **`phase3_projection_state` (Table):** Stores metadata about which article was projected to which serving stores, ensuring that when an article is modified (e.g. topic changes, hidden flag set), the projectors can clean up stale Redis memberships.

---

## 3. Redis serving Data Model (Cache & Feeds)

Redis serves as the low-latency read layer. All user feeds (global, country, topic) are served out of Redis memory in milliseconds.

```
┌─────────────────────────────────────────────────────────────┐
│                       Redis Memory                          │
│                                                             │
│  Sorted Sets (Feed Indexes):                                │
│  feed:global  ──> [ {article_id, published_at_epoch}, ... ] │
│  feed:country:1  ──> [ {article_id, score}, ... ]           │
│  feed:topic:politics  ──> [ {article_id, score}, ... ]      │
│                                                             │
│  Hashes (Feed Cards):                                       │
│  article:news:185011                                        │
│  ├── title: "..."                                           │
│  ├── excerpt: "..."                                         │
│  └── imageUrl: "..."                                        │
└─────────────────────────────────────────────────────────────┘
```

### Redis Key Families
1.  **Feed Cards (Hashes):** Key: `article:{article_id}`
    *   Stores denormalized display-only data.
    *   **Fields:** `article_id`, `title`, `url`, `excerpt`, `image_url`, `source_name`, `source_domain`, `root_topic_id`, `root_topic_label`, `published_at` (epoch seconds), `country_id`, `language_code`, `is_video`.
    *   Full body text is omitted to optimize memory footprint.
2.  **Feed Indexes (Sorted Sets - ZSETs):**
    *   **Structure:** Stores only the `article_id` string as the member.
    *   **Score:** The publication time represented as a **Unix epoch second**.
    *   **Feeds:**
        *   Global Feed: `feed:global`
        *   Country Feed: `feed:country:{country_id}`
        *   Topic Feed: `feed:topic:{root_topic_id}`
        *   Country-Topic Combined: `feed:country:{country_id}:topic:{root_topic_id}`
3.  **Eviction & Sliding Retention Window:**
    *   To keep memory usage bounded, Redis indices implement a sliding window. Feeds retain articles for a window of **10 days**.
    *   Stale articles are automatically pruned from ZSETs, and the corresponding `article:{article_id}` hash is configured with a Time-To-Live (TTL) of **10 days** (864,000 seconds), leading to automatic eviction.

---

## 4. Qdrant Vector database Setup (Semantic Retrieval)

**Qdrant** is the vector database responsible for storing high-dimensional embeddings and supporting semantic similarity searches.

### Collection Topology
*   **Collection Name:** `imperium_articles` (or `phase3_articles`)
*   **Vector Configuration:** Configured for a single vector stream:
    *   **Size:** 3584 dimensions (matching the NVIDIA BGE-M3 embedding structure).
    *   **Distance Metric:** **Cosine Similarity**.

### Payload Filtering Schema
Qdrant stores metadata alongside the vector in a structured payload to allow pre-filtering (combining keyword and vector searches in a single pass):
*   `article_id` (string)
*   `country_id` (integer)
*   `root_topic_id`, `primary_topic_id` (string)
*   `published_at` (integer, epoch seconds)
*   `is_visible` (boolean, used for soft-delete filtering)
*   `language_id` (integer)
*   `source_domain` (string)

---

## 5. Elasticsearch full-Text Search Index

**Elasticsearch** supports keyword searches, prefix matchings, and metadata aggregations.

### Index Properties
*   **Index Name:** `imperium_articles_search`
*   **Analyzer:** Custom English/Multilingual text analyzer applied to the `title`, `excerpt`, and `body_text_clean` fields.
*   **Field Mapping:**
    *   `title` (text, with keyword subfield)
    *   `body_text_clean` (text)
    *   `excerpt` (text)
    *   `published_at`, `crawled_at`, `processed_at` (date formats)
    *   `country_id`, `country_name` (keyword filters)
    *   `source_domain` (keyword filter)
    *   `is_visible` (boolean filter, defaults to `true`)
