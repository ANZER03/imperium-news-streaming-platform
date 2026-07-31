# 01 - Overview and System Architecture

## 1. Project Context & Objectives

The **Imperium News Streaming Platform** is a modern, real-time, event-driven intelligence system designed for news ingestion, enrichment, storage, and serving. In modern news publishing and intelligence environments, latency, content quality, semantic search, and highly personalized experiences are critical competitive factors. 

The primary objective of the Imperium platform is to replace a legacy, database-centric CRUD architecture with a highly scalable, real-time, event-driven stream processing pipeline. This pipeline converts raw scraped news updates into enriched, classified, and indexed content ready for low-latency serving on web and mobile client interfaces.

---

## 2. Problem Statement (Legacy vs. Modern)

In the legacy architecture of the Imperium platform, PostgreSQL functioned as a monolithic system of record and query engine. It was concurrently responsible for:
1.  **Ingestion:** Accepting raw, high-throughput inserts from scraping and crawling services.
2.  **Processing & Normalization:** Running periodic batch SQL scripts to clean text, resolve dimensions, and categorize content.
3.  **Serving:** Processing complex relational queries, joins, and aggregates for user feeds and search interfaces.

### Consequences of the Monolithic DB Approach
*   **Database Contention:** High-write lock contention from scraping workers blocked or severely degraded read performance for user-facing feed queries.
*   **High Latency:** Complex SQL joins across millions of articles to generate localized and topic-specific feeds resulted in poor response times (typically several seconds under moderate user loads).
*   **Scalability Bottlenecks:** Scaling a relational database vertically to support concurrent write/read spikes is economically and architecturally unsustainable.
*   **Lack of Real-Time Flow:** Category matching and enrichment occurred in scheduled batch intervals, meaning newly scraped news did not appear on user feeds in real-time.
*   **No Semantic Context:** Keyword-only queries could not capture the thematic or conceptual meaning of articles.

### 2.1 Core Architectural Principles: CQRS and Event Sourcing
To scale to millions of active news records or social media posts under high-frequency writes (from crawling bots and scraping microservices) while keeping client serving latency within **50-500ms**, the system is designed around two core patterns:

1.  **CQRS (Command Query Responsibility Segregation):**
    *   **The Command Path (Writes):** Writing is handled exclusively in the source relational database by the scrapers. It is optimized for transactions and rapid inserts.
    *   **The Query Path (Reads):** Client APIs query read-optimized projection stores (Redis for feeds, Elasticsearch for search, and Qdrant for vector search) rather than Postgres. These stores are populated asynchronously. This segregates read and write responsibilities, completely removing relational joins and lock contentions.
2.  **Event Sourcing via Change Data Capture (CDC):**
    *   Instead of polling the database, the system treats database changes as an immutable stream of write commands.
    *   By decoding the Postgres Write-Ahead Log (WAL) with Debezium, every INSERT, UPDATE, and DELETE is captured as an event and appended to a Kafka topic. These events serve as the single, replay-safe source of truth for all downstream projections.

---

## 3. High-Level System Architecture

The modern architecture separates concerns into distinct layers: Ingestion, Processing, Storage, and Serving. It is built as a fully decoupled, event-driven streaming topology deployed on Kubernetes.

```mermaid
graph TD
    %% Source Layer
    subgraph Source ["Source Layer"]
        Scrapers["Scrapers & Crawlers"] -->|Writes| SrcDB[("PostgreSQL (Source DB)")]
    end

    %% Ingestion Layer
    subgraph Ingestion ["Ingestion Layer"]
        SrcDB -->|WAL Log changes| Debezium["Debezium Postgres Source Connector"]
        Debezium -->|Publishes Avro events| KafkaBroker[("Kafka Clusters (Strimzi)")]
        SR["Avro Schema Registry"] <-->|Governs schemas| Debezium
    end

    %% Processing Layer
    subgraph Processing ["Processing & Enrichment Layer"]
        SparkDim["Spark Dimension Materializer"] <-->|Reads CDC / Writes curated dims| TargetDB
        SparkProcessor["Spark Canonical Article Processor"] -->|Reads raw CDC news| KafkaBroker
        SparkProcessor -->|Joins curated dimensions| TargetDB
        SparkProcessor -->|Emits canonical articles| KafkaBroker
        
        SparkClassifier["Spark Article Classifier"] -->|Reads pending articles| KafkaBroker
        SparkClassifier -->|Requests text vectors| EmbeddingGateway["Embedding Gateway (NVIDIA/Gemma)"]
        SparkClassifier -->|Classifies via cosine similarity| TargetDB
        SparkClassifier -->|Emits updated articles| KafkaBroker
    end

    %% Storage Layer
    subgraph Storage ["Storage Layer"]
        TargetDB[("PostgreSQL (Target DB)")]
        RedisCache[("Redis (Feed Cards & ZSETs)")]
        QdrantDB[("Qdrant (Vector Database)")]
        ES[("Elasticsearch (Search Index)")]
    end

    %% Projectors
    subgraph Projections ["Projectors Layer"]
        ProjPostgres["Postgres Projector"] -->|Saves cleaned articles| TargetDB
        ProjRedis["Redis Projector"] -->|Pushes feeds & cards| RedisCache
        ProjQdrant["Qdrant Projector"] -->|Indexes vectors & payloads| QdrantDB
        ProjES["Elasticsearch Projector"] -->|Indexes for full-text search| ES
    end
    
    KafkaBroker -->|Consumes canonical articles| ProjPostgres
    KafkaBroker -->|Consumes canonical articles| ProjRedis
    KafkaBroker -->|Consumes canonical articles| ProjQdrant
    KafkaBroker -->|Consumes canonical articles| ProjES

    %% Serving Layer
    subgraph Serving ["Serving & UI Layer"]
        KongGW["Kong API Gateway"] -->|Routes API calls| BackendAPI["Spring Boot WebFlux Backend"]
        KongGW -->|Routes web assets| NextUI["Next.js Frontend UI"]
        
        BackendAPI -->|Reads feeds & cards| RedisCache
        BackendAPI -->|Reads detailed articles| TargetDB
        BackendAPI -->|Performs keyword search| ES
    end

    classDef layer fill:#f9f9f9,stroke:#333,stroke-width:1px;
    class Source,Ingestion,Processing,Storage,Projections,Serving layer;
```

---

## 4. Platform Data Flow

The lifecyle of an article flows asynchronously through six major stages:

```mermaid
sequenceDiagram
    autonumber
    participant Scraper as Scraper
    participant PostgresSource as Postgres Source DB
    participant Debezium as Debezium CDC Connector
    participant Kafka as Kafka Broker
    participant Spark as Spark Structured Streaming
    participant Gateway as Embedding Gateway
    participant Projectors as Python Projectors
    participant Stores as Storage Engines (Postgres, Redis, Qdrant)
    participant Spring as Spring Boot Backend

    Scraper->>PostgresSource: Insert raw news row
    PostgresSource->>Debezium: Write Ahead Log (WAL) update
    Debezium->>Kafka: Publish raw CDC event (Avro format)
    Spark->>Kafka: Consume raw news CDC event
    Spark->>Spark: Enrich with reference data & build Excerpt
    Spark->>Kafka: Publish Canonical Article (classification_status = pending)
    
    par Projecting Pending Article
        Kafka->>Projectors: Read pending article event
        Projectors->>Stores: Project Feed Card & indexes to Redis
    and Classifying Article
        Spark->>Kafka: Consume pending canonical article event
        Spark->>Gateway: Send title + first 30 body words for embedding
        Gateway->>Spark: Return 3584-dimension vector (NVIDIA BGE-M3)
        Spark->>Spark: Cosine similarity search against active topic vectors
        Spark->>Kafka: Publish updated Canonical Article (classification_status = classified)
    end

    Kafka->>Projectors: Read classified article event
    Projectors->>Stores: Update Redis Topic Feed (ZSET)
    Projectors->>Stores: Index vector + payload filters in Qdrant
    Projectors->>Stores: Save durable Cleaned Article in PostgreSQL

    Spring->>Stores: Fetch recent feeds (Redis) or semantic search (Qdrant/ES)
    Spring-->>Spring: Hydrate Feed Cards
```

---

## 5. Domain Ubiquitous Language

To ensure communication integrity across data engineering, software engineering, and operations, the following terminology is strictly enforced:

*   **Raw News Record:** A source PostgreSQL news row captured through CDC before cleaning, normalization, or enrichment.
*   **Canonical Article:** The stable event contract emitted by processing and consumed by serving projectors. This is the primary boundary contract between processing and storage/serving.
*   **Cleaned Article:** The durable, long-term PostgreSQL article record stored after cleaning, enrichment, and metadata resolution.
*   **Article ID:** The deterministic platform-wide identifier for a canonical article, formatted as `news:{source_news_id}`.
*   **Source News ID:** The original auto-incremented primary key of the news row in the source database.
*   **Excerpt:** The deterministic short text snippet (first 30 clean words) derived from the cleaned body text for feed cards.
*   **Topic Taxonomy:** The hierarchical business topic tree stored as the source of truth in PostgreSQL.
*   **Primary Topic:** The selected leaf topic assigned to an article by the embedding similarity classifier.
*   **Root Topic:** The top-level parent category derived from the primary topic using the topic taxonomy configuration.
*   **Topic Embedding:** The precomputed vector representation of a topic's metadata used for similarity matching.
*   **Projector:** An independent service that consumes canonical article events and writes serving projections to target data stores.
*   **Feed Card:** The compact JSON hash stored in Redis used to render feeds without fetching full article bodies.
*   **Feed Index:** A Redis Sorted Set (ZSET) containing only Article IDs scored by publication timestamps.
*   **Vector Projection:** The Qdrant point containing the article embedding and filtering payloads.
