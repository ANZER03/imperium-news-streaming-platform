# Product Requirements Document: Real-Time News Streaming Platform

## 1. Executive Summary
The Imperium News Streaming Platform aims to modernize the existing database-centric news pipeline into a high-performance, event-driven streaming architecture. By leveraging CDC (Change Data Capture), Kafka, and Spark, we enable real-time processing and low-latency serving of news content.

## 2. Objectives
- **Decouple Ingestion from Serving**: Move away from heavy PostgreSQL reads for user feeds.
- **Real-Time Enrichment**: Automate classification and embedding generation as articles are ingested.
- **Semantic Retrieval**: Enable vector search and similar article discovery.
- **Scalability**: Support increasing volumes of news data with independent scaling of processing units.

## 3. Architecture Overview

### 3.1 Ingestion Stage
- **Source**: Production PostgreSQL database.
- **Technology**: Debezium on Kafka Connect.
- **Output**: Raw CDC events in Avro format published to Kafka topics.

### 3.2 Processing Stage
- **Technology**: Spark Structured Streaming.
- **Dimensions**: Materializing reference data (countries, sources, categories) into curated formats.
- **Canonicalization**: Converting raw news records into a standard "Canonical Article" format.
- **Classification**: AI-driven topic assignment using NVIDIA's `bge-m3` embeddings.

### 3.3 Storage Stage
- **Relational**: PostgreSQL for durable system-of-record storage.
- **Cache/Feed**: Redis for sub-millisecond feed delivery.
- **Vector**: Qdrant for semantic search and hybrid filtering.

### 3.4 Serving Stage
- **API**: Reactive Spring Boot (or similar) backend.
- **Capabilities**: Paginated feeds, country-specific feeds, topic feeds, and semantic search.

## 4. Key Data Contracts
- **CDC Envelope**: Debezium standard with `before`, `after`, and `op` fields.
- **Canonical Article**: A cleaned, enriched, and classified representation of a news item.
- **Projection State**: Replay-safe tracking of article status across different storage layers.

## 5. Success Metrics
- **Ingestion Latency**: Time from PG commit to Kafka availability < 1s.
- **Processing Latency**: Time from Kafka raw to Redis/Qdrant availability < 30s.
- **Serving Latency**: Redis feed retrieval < 50ms (p99).
- **Search Relevance**: Accurate semantic matches via Qdrant.
