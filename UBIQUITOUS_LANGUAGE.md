# Ubiquitous Language

## Article Processing

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Raw News Record** | A source PostgreSQL news row captured through CDC before cleaning or enrichment. | Raw article, raw CDC article |
| **Canonical Article** | The stable event contract emitted by processing and consumed by serving projections. | News event, processed news, article DTO |
| **Cleaned Article** | The durable PostgreSQL article record after cleaning, enrichment, and processing metadata are applied. | Enriched article, normalized article |
| **Article ID** | The deterministic platform identifier for one canonical article, namespaced from the source system. | News ID, source ID |
| **Source News ID** | The original identifier of the source PostgreSQL news row. | Article ID, raw ID |
| **Classification Input** | The text embedded for article classification, built from title plus first 30 cleaned body words. | Prompt, classification text |
| **Article Embedding** | The vector representation of an article used for topic classification and semantic search. | News vector, content vector |
| **Excerpt** | The deterministic short text shown in feed cards and derived from cleaned article text. | Summary, snippet |

## Topic Taxonomy

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Topic Taxonomy** | The PostgreSQL source of truth for hierarchical business topics. | Category list, topic config |
| **Root Topic** | A broad top-level topic used for Phase 3 Redis topic feeds. | Parent topic, category |
| **Primary Topic** | The selected leaf topic assigned to an article by embedding similarity. | Topic, category, leaf category |
| **Secondary Topic** | A non-primary candidate topic kept for debugging and search payloads. | Alternative topic, extra category |
| **Topic Candidate** | One of the top matching leaf topics with a similarity score. | Candidate category, classification option |
| **Topic Confidence** | The similarity score for the selected primary topic. | Probability, certainty |
| **Topic Embedding** | The vector representation of topic metadata used for article-topic matching. | Category vector, taxonomy vector |
| **Taxonomy Version** | The version marker for active topic metadata and related topic embeddings. | Topic version, category version |

## Serving Projections

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Projection** | A serving-optimized representation derived from a canonical article. | Copy, cache, denormalized table |
| **Projector** | A service that writes a projection to Redis, Qdrant, or PostgreSQL. | Writer, sync job |
| **Feed Card** | The compact Redis article payload used to render recent feeds. | Card cache, article cache |
| **Feed Index** | A Redis sorted set containing article IDs for one feed surface. | Feed list, timeline |
| **Vector Projection** | The Qdrant article embedding and filter payload used for semantic search. | Search document, vector record |
| **Projection State** | Stored metadata needed to update or remove previous feed memberships safely. | Cache state, sync state |

## Classification And Embeddings

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Embedding Gateway** | The centralized internal service that calls NVIDIA embeddings with batching and global rate limiting. | Embedding client, API wrapper |
| **Embedding Provider** | The external provider that returns embeddings for text inputs. | Model API, AI service |
| **Embedding Similarity Classifier** | The classifier that assigns topics by comparing article embeddings with topic embeddings. | Model classifier, AI classifier |
| **Classification Status** | The lifecycle state of article topic classification: pending, classified, or failed. | Topic status, model status |
| **Dimension Status** | The lifecycle state of dimension enrichment: complete, partial, or pending required. | Enrichment status, lookup status |

## Visibility And Lifecycle

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Visible Article** | An article eligible for product serving because `is_visible = true` and `is_deleted = false`. | Active article, published article |
| **Deleted Article** | An article marked deleted by source CDC or business state while retained for audit. | Removed article, hard-deleted article |
| **Pending Required** | A state where required minimum data is missing and canonical emission must wait. | Blocked, invalid |
| **Replay-Safe Upsert** | An idempotent write keyed by article ID that can run repeatedly without duplicates. | Insert-or-update, sync write |

## Relationships

- A **Raw News Record** produces zero or one **Canonical Article**.
- A **Canonical Article** produces one **Cleaned Article** and zero or more **Projections**.
- A **Feed Card** belongs to exactly one **Canonical Article**.
- A **Feed Index** contains many **Article IDs** and no article bodies.
- A **Primary Topic** is always a leaf in the **Topic Taxonomy**.
- A **Root Topic** is derived from a **Primary Topic** through the **Topic Taxonomy**.
- A **Topic Embedding** belongs to one **Topic Taxonomy** version.
- An **Embedding Similarity Classifier** compares one **Article Embedding** with many **Topic Embeddings**.
- A **Projector** must depend on abstractions for storage and external clients.

## Example Dialogue

> **Dev:** "Can Redis store the full **Cleaned Article**?"
>
> **Domain expert:** "No. Redis stores only the **Feed Card** and **Feed Indexes**. PostgreSQL owns the **Cleaned Article**."
>
> **Dev:** "Does the classifier return the **Root Topic**?"
>
> **Domain expert:** "No. It returns the leaf **Primary Topic**. The **Root Topic** is derived from the **Topic Taxonomy**."
>
> **Dev:** "If NVIDIA is slow, do we delay the feed?"
>
> **Domain expert:** "No. The **Canonical Article** can emit with `classification_status = pending`, then topic projection updates later."
>
> **Dev:** "Can we replace Qdrant later?"
>
> **Domain expert:** "Yes. The **Vector Projector** depends on an abstraction, so another vector store can be wired without changing core logic."

## Flagged Ambiguities

- "topic" was used for both broad categories and leaf categories. Use **Root Topic** for broad feed topics and **Primary Topic** for the selected leaf topic.
- "article ID" and "news ID" were overlapping. Use **Article ID** for platform identity and **Source News ID** for the original PostgreSQL row.
- "classification model" could mean LLM classification or embedding similarity. Phase 3 uses **Embedding Similarity Classifier** only.
- "cache" was used for Redis article data. Use **Feed Card** for Redis article payload and **Feed Index** for Redis sorted sets.
- "embedding service" could mean external NVIDIA API or internal service. Use **Embedding Provider** for NVIDIA and **Embedding Gateway** for the internal service.
