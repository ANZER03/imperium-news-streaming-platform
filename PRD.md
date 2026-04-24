# Product Requirements Document (PRD)

## Imperium Real-Time News Streaming Platform — MVP 1

---

## 1. Overview

This document defines the first MVP of Imperium’s new **real-time data streaming platform** for news ingestion, processing, storage, and serving.

The goal is to transition from a database-centric architecture to a **scalable, event-driven system** that supports:

* near real-time content processing
* low-latency feed serving
* future extensibility for personalization and analytics

This MVP introduces a clean separation between:

* ingestion
* processing
* storage
* serving

and integrates **Qdrant** as a vector search and semantic retrieval layer.

---

## 2. Problem Statement

The current platform relies heavily on PostgreSQL for:

* ingesting scraped news
* storing content
* querying feeds
* serving user requests

This creates:

* high database contention
* slow feed performance
* complex and expensive queries
* limited scalability
* no real-time processing capabilities

A new architecture is required to decouple responsibilities and enable real-time data flow.

---

## 3. Goals

### Primary Goals

* Enable real-time ingestion of news data via CDC
* Build a scalable event-driven processing pipeline
* Reduce read load on PostgreSQL
* Deliver low-latency feed responses using Redis
* Introduce semantic search capabilities using Qdrant
* Establish a foundation for future personalization and analytics

### Secondary Goals

* Ensure system observability and reliability
* Maintain clear and extensible architecture
* Support measurable performance validation

---

## 4. Non-Goals (MVP 1)

* Advanced personalized ranking
* Full recommendation engine
* Real-time user behavior analytics
* Complex notification systems
* Full-text search engine replacement
* Multi-region deployment

---

## 5. Users

### End Users

* Mobile application users
* Web application users

### Internal Users

* Product and business teams
* Engineering and data teams

---

## 6. Scope

### In Scope

#### Ingestion

* Capture changes from PostgreSQL using CDC
* Publish events to Kafka
* Use Avro serialization with Schema Registry
* Maintain raw topics per table

#### Processing

* Normalize and clean article data
* Enrich articles with metadata (country, category, source)
* Generate embeddings for articles
* Prepare feed-ready content

#### Storage

* PostgreSQL as system of record
* Redis for feed serving and caching
* Qdrant for vector and hybrid search
* Kafka for event streaming and replay

#### Serving

* Backend APIs for feed retrieval
* Backend APIs for semantic search and similar articles
* Mobile and web client integration

---

## 7. Source Data

The ingestion pipeline will consume selected PostgreSQL tables including:

* core article/news table
* source/link metadata tables
* authority/source context tables
* reference tables (language, country, category)

These tables provide both content and context necessary for processing and serving. 

---

## 8. Functional Requirements

### FR-1: Ingestion

* Capture inserts, updates, and deletes from PostgreSQL
* Publish events to Kafka with low latency
* Ensure schema governance via Schema Registry
* Guarantee event ordering per key
* Support replay and recovery

### FR-2: Processing

* Convert raw CDC events into canonical article events
* Clean and normalize article content
* Enrich with metadata (country, language, category)
* Generate embeddings for semantic use cases
* Filter invalid or non-visible articles
* Output feed-ready events

### FR-3: Storage

* Persist articles in PostgreSQL for durability
* Store feed indexes and article cache in Redis
* Store embeddings and metadata in Qdrant
* Maintain Kafka topics for streaming and replay

### FR-4: Serving

* Provide low-latency feed APIs using Redis
* Support pagination/infinite scroll
* Provide semantic search via Qdrant
* Provide “similar articles” functionality
* Minimize synchronous PostgreSQL reads

### FR-5: Operations

* Monitor ingestion, processing, and serving pipelines
* Track Kafka lag and system health
* Support alerting and failure recovery

---

## 9. Non-Functional Requirements

### Scalability

* Independently scalable ingestion, processing, and serving layers

### Performance

* Low latency for feed responses
* Near real-time processing pipeline

### Reliability

* No data loss on restart or failure
* Replay capability via Kafka

### Security

* Secure communication between services
* Least-privilege access control
* Secrets management
* Encrypted data in transit

### Maintainability

* Modular architecture
* Clear data contracts
* Versioned schemas

### Observability

* Metrics, logs, and tracing for all components
* Monitoring dashboards and alerting

---

## 10. Architecture

### High-Level Architecture

#### 1. Source Layer

* Scraping and crawling services
* PostgreSQL production database

#### 2. Ingestion Layer

* CDC connector (e.g., Debezium)
* Kafka Connect
* Kafka topics (raw CDC events)
* Schema Registry (Avro)

#### 3. Processing Layer

* Stream processing (Spark Structured Streaming)
* Data normalization
* Content cleaning
* Metadata enrichment
* Embedding generation
* Filtering and transformation

#### 4. Storage Layer

* PostgreSQL: long-term storage and system of record
* Redis: feed indexes and low-latency serving cache
* Qdrant: vector database for embeddings and hybrid search
* Kafka: event storage and replay

#### 5. Serving Layer

* Asynchronous backend APIs
* Feed retrieval endpoints (Redis)
* Search and similarity endpoints (Qdrant)
* Mobile and web clients

---

## 11. Data Flow

1. News is scraped and stored in PostgreSQL
2. CDC captures database changes
3. Events are published to Kafka
4. Processing jobs consume events
5. Articles are cleaned, enriched, and embedded
6. Outputs are:

   * stored in PostgreSQL (enriched data)
   * indexed in Redis (feed serving)
   * indexed in Qdrant (vector search)
7. Backend APIs serve:

   * feeds from Redis
   * semantic queries from Qdrant

---

## 12. Storage Design

### PostgreSQL

* System of record
* Stores raw and enriched article data
* Supports long-term persistence

### Redis

* Stores feed indexes (e.g., lists, sorted sets)
* Stores article cache for fast retrieval
* Optimized for low-latency reads

### Qdrant

* Stores article embeddings
* Stores metadata for filtering (country, language, category, source, date)
* Supports:

  * semantic search
  * hybrid search (vector + filters)
  * similar article retrieval
  * clustering and future recommendation use cases

---

## 13. Product Principles

* PostgreSQL is the source of truth
* Kafka is the event backbone
* Redis is the primary serving layer
* Qdrant is the semantic retrieval layer
* Processing is modular and event-driven
* Backend is lightweight and non-blocking
* Architecture is designed for future extensibility

---

## 14. Deliverables

### Technical

* CDC ingestion pipeline
* Kafka topics and schema definitions
* Stream processing jobs
* Redis data model
* Qdrant integration and indexing pipeline
* Backend APIs for feed and search

### Validation

* Performance benchmarks
* Latency measurements
* Reliability tests

### Documentation

* Architecture diagrams
* Data flow documentation
* Operational guidelines
* Final technical report

---

## 15. Success Metrics

* Reduced load on PostgreSQL for feed queries
* Stable and reliable CDC ingestion
* Near real-time article processing
* Low-latency feed response from Redis
* Functional semantic search via Qdrant
* System resilience under restart and failure scenarios

---

## 16. Risks

* CDC complexity and schema evolution issues
* High frequency of non-critical updates triggering reprocessing
* Redis data modeling complexity
* Embedding generation cost and latency
* Qdrant indexing and reindexing challenges
* Data consistency between storage layers

---

## 17. Future Phases

### Phase 2

* User activity tracking pipeline
* Event-based analytics
* Trending computation
* Phase 2 decision note: [`docs/product/phase-2-cdc-decision.md`](docs/product/phase-2-cdc-decision.md)
* Source readiness runbook: [`docs/operations/source-cdc-readiness-runbook.md`](docs/operations/source-cdc-readiness-runbook.md)

### Phase 3

* Canonical article processing and serving projections
* Topic taxonomy and model-only classification
* Redis feed projection and Qdrant vector projection
* Phase 3 PRD: [`docs/product/phase-3-processing-canonical-article-prd.md`](docs/product/phase-3-processing-canonical-article-prd.md)

### Phase 4

* Advanced search and discovery
* Notifications
* Experimentation framework

---

## 18. Development Approach

The project will follow **spec-driven development**:

* define specifications per component
* validate before implementation
* implement incrementally by phase

---

## 19. Summary

This MVP establishes a **modern streaming architecture** for Imperium:

* decoupled ingestion, processing, and serving
* scalable and reliable data flow
* fast feed delivery using Redis
* semantic capabilities powered by Qdrant

It provides a strong technical foundation for future expansion into personalization, analytics, and intelligent content delivery.
