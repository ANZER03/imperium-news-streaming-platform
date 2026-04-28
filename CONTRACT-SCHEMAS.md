# Data Contract Schemas

This document defines the storage schemas and access patterns for the Imperium News Platform. Backend engineers should use these contracts to implement API endpoints and data access layers.

---

## 1. PostgreSQL (Full Article Details)

**Database:** `imperium-news-source`  
**Table:** `imperium_news_articles`

Used for deep-dive article views and historical analysis.

| Column | Type | Nullable | Description |
| :--- | :--- | :--- | :--- |
| `article_id` | `TEXT` | NO | Primary Key. UUID or deterministic hash. |
| `source_news_id` | `BIGINT` | YES | ID from the original news source. |
| `link_id` | `BIGINT` | YES | Internal reference to the link discovery ID. |
| `authority_id` | `BIGINT` | YES | ID of the publishing authority. |
| `country_id` | `INTEGER` | YES | Primary country ID. |
| `country_name` | `TEXT` | YES | Display name of the country. |
| `source_name` | `TEXT` | YES | Human-readable name of the source (e.g., "Le Monde"). |
| `source_domain` | `TEXT` | YES | Root domain of the source (e.g., "lemonde.fr"). |
| `rubric_id` | `INTEGER` | YES | Source-specific category ID. |
| `rubric_title` | `TEXT` | YES | Source-specific category name. |
| `language_id` | `INTEGER` | YES | Internal language ID. |
| `language_code` | `VARCHAR(10)` | YES | ISO language code (e.g., "fr", "en"). |
| `classification_status` | `VARCHAR(50)`| NO | `pending` or `classified`. |
| `classification_method` | `VARCHAR(100)`| YES | Model or method used (e.g., `zero-shot-classification`). |
| `classification_model` | `VARCHAR(100)`| YES | Specific model name. |
| `root_topic_id` | `VARCHAR(100)`| YES | Top-level taxonomy ID. |
| `root_topic_label` | `TEXT` | YES | Human-readable name of the root topic. |
| `primary_topic_id` | `VARCHAR(100)`| YES | Most specific leaf-topic ID. |
| `primary_topic_label` | `TEXT` | YES | Human-readable name of the primary topic. |
| `topic_confidence` | `FLOAT8` | YES | Model confidence score (0.0 to 1.0). |
| `topic_candidates` | `JSONB` | YES | List of all candidate topics with scores. |
| `title` | `TEXT` | YES | Article headline. |
| `url` | `TEXT` | YES | Original link to the article. |
| `body_text` | `TEXT` | YES | Raw full text content. |
| `body_text_clean` | `TEXT` | YES | Cleaned/preprocessed text for search. |
| `excerpt` | `TEXT` | YES | Short summary/lead text. |
| `image_url` | `TEXT` | YES | Main article image URL. |
| `video_url` | `TEXT` | YES | Video content URL if applicable. |
| `reporter` | `TEXT` | YES | Author name. |
| `source_date_text` | `TEXT` | YES | Raw date string from source. |
| `published_at` | `BIGINT` | YES | Unix timestamp (seconds). |
| `crawled_at` | `BIGINT` | YES | Unix timestamp of ingestion. |
| `is_video` | `BOOLEAN` | YES | True if the article is primarily video. |
| `dimension_status` | `VARCHAR(50)`| YES | Status of enrichment metadata. |
| `missing_dimensions` | `JSONB` | YES | List of fields that couldn't be enriched. |
| `embedding_vector` | `REAL[]` | YES | 768-dimensional vector (Nomic Embed). |
| `processed_at` | `TIMESTAMP` | YES | When the record was projected to Postgres. |
| `classified_at` | `TIMESTAMP` | YES | When classification was finalized. |

---

## 2. Redis (Fast Feed & Cache)

**TTL Policy:** All keys expire after **12 days**.

### A. Article Metadata Hash
**Pattern:** `news:{article_id}`  
**Type:** `HASH`

Used for rendering feed cards without hitting Postgres.

| Field | Description |
| :--- | :--- |
| `title` | Article headline. |
| `excerpt` | Short lead text. |
| `image_url` | URL to the thumbnail/main image. |
| `source_name` | Source brand name. |
| `source_domain` | Source domain. |
| `country_id` | Country ID for flag rendering. |
| `country_name` | Country label. |
| `language_code` | Language for localization. |
| `published_at` | Unix timestamp string. |
| `is_video` | "1" or "0". |
| `root_topic_id` | Main topic ID. |
| `root_topic_label` | Human-readable topic. |
| `topic_confidence`| Confidence score string. |

### B. Discovery & Topic Feeds
**Type:** `ZSET` (Sorted Set)  
**Score:** Unix Timestamp (`published_at`)

Used for paginated retrieval of article IDs sorted by date.

| Key Pattern | Description |
| :--- | :--- |
| `feed:global` | All articles across all countries/topics. |
| `feed:country:{country_id}` | Feed restricted to a specific country. |
| `feed:topic:{topic_id}` | Feed restricted to a specific root topic. |
| `feed:country:{c_id}:topic:{t_id}` | Intersection feed (e.g., "Politics in France"). |

---

## 3. Qdrant (Semantic Search)

**Collection:** `imperium_articles`  
**Vector Size:** 768  
**Distance Metric:** Cosine

Used for semantic search, recommendation engines, and "Similar Articles" features.

### Point ID
- **Type:** `UUID` (Deterministic UUID derived from `article_id`).

### Payload Schema (Metadata for Filtering)

| Field | Type | Indexed | Description |
| :--- | :--- | :--- | :--- |
| `article_id` | `keyword` | NO | Unique internal ID. |
| `source_news_id` | `integer` | YES | Source ID. |
| `title` | `text` | NO | Searchable title. |
| `excerpt` | `text` | NO | Searchable excerpt. |
| `country_id` | `integer` | YES | For country-based search filtering. |
| `language_id` | `integer` | YES | For language-based search filtering. |
| `root_topic_id` | `keyword` | YES | For topic-based search filtering. |
| `root_topic_label`| `keyword` | NO | Human-readable topic. |
| `published_at` | `integer` | YES | For date-range filtering. |
| `image_url` | `keyword` | NO | Thumbnail URL. |
