# Imperium News Streaming Platform — System Documentation

This document serves as the master catalog and technical summary of the **Imperium News Streaming Platform**. Designed to replace a legacy, database-centric CRUD system, Imperium is a real-time, event-driven intelligence pipeline that ingests, cleans, enriches, classifies, stores, and serves news articles at scale.

### 📐 Architectural Patterns: CQRS & Event Sourcing
To support high-throughput write workloads (e.g. continuous scraping of 24M+ records) while maintaining a strict serving latency budget of **50–500ms**, the system implements a strict decoupling of write and read operations:
*   **Write Side (Commands):** Ingestion is triggered by crawling bots inserting raw news records into the production database. These modifications are captured at the database transaction-log level via **CDC (Change Data Capture)** and processed as an immutable stream of write commands (**Event Sourcing**).
*   **Read Side (Queries):** The stream processing layer enriches these events and independent **Projectors** materialize read-optimized projections in Redis (for recent feeds), Qdrant (for vector search), and Elasticsearch (for keyword search). Client APIs query these projection stores exclusively, avoiding relational `JOIN`s on millions of rows and eliminating read/write database lock contention.

For the full detailed specifications, architecture choices, and operation guides, see the localized technical reports in the [project-docs/](file:///home/anouar.zerrik/projects/pfe/imperium-news-streaming-platform/project-docs) folder.

---

## 📖 Table of Contents (Technical Chapters)

1.  **[01 - System Overview & Core Architecture](file:///home/anouar.zerrik/projects/pfe/imperium-news-streaming-platform/project-docs/01-overview-and-architecture.md)**
    *   Goal, problem statement, ubiquitous language, and system data flows.
2.  **[02 - Change Data Capture Ingestion Pipeline](file:///home/anouar.zerrik/projects/pfe/imperium-news-streaming-platform/project-docs/02-ingestion.md)**
    *   WAL decoding, Debezium configuration, Avro serialization via Schema Registry, and event ordering.
3.  **[03 - Real-Time Stream Processing & Enrichment](file:///home/anouar.zerrik/projects/pfe/imperium-news-streaming-platform/project-docs/03-processing.md)**
    *   Spark Structured Streaming, dimension materializer, late-arriving dimensions, Excerpt generation, and embedding similarity classification.
4.  **[04 - Multi-Engine Storage Architecture](file:///home/anouar.zerrik/projects/pfe/imperium-news-streaming-platform/project-docs/04-storage.md)**
    *   Role of PostgreSQL (CNPG), Redis, Qdrant, and Elasticsearch stores.
5.  **[05 - Serving Projectors & Data Synchronization](file:///home/anouar.zerrik/projects/pfe/imperium-news-streaming-platform/project-docs/05-projectors.md)**
    *   Decoupled Python-based projectors, update propagation rules, and deletion handling.
6.  **[06 - Backend API & Reactive Serving Layer](file:///home/anouar.zerrik/projects/pfe/imperium-news-streaming-platform/project-docs/06-backend.md)**
    *   Spring Boot WebFlux reactive model, R2DBC database layer, and the Feed V3 Timestamp-Window Scanner.
7.  **[07 - Frontend User Interface & Design System](file:///home/anouar.zerrik/projects/pfe/imperium-news-streaming-platform/project-docs/07-frontend.md)**
    *   Next.js 15 routing, React 19 visual design system (editorial paper layout), Zustand states, and client-side hydration.
8.  **[08 - Kubernetes Infrastructure & Helm Deployment](file:///home/anouar.zerrik/projects/pfe/imperium-news-streaming-platform/project-docs/08-deployment.md)**
    *   k3s cluster architecture, Helm umbrella chart, Operators topology, Kong Gateway, and local registry setup.
9.  **[09 - System Observability & ClickStack Architecture](file:///home/anouar.zerrik/projects/pfe/imperium-news-streaming-platform/project-docs/09-observability.md)**
    *   ClickStack (HyperDX + ClickHouse + MongoDB), OpenTelemetry Collector pipelines, and telemetry metrics.
10. **[10 - CI/CD Pipeline & GitOps Continuous Deployment](file:///home/anouar.zerrik/projects/pfe/imperium-news-streaming-platform/project-docs/10-cicd-gitops.md)**
    *   Jenkins build agent configurations and ArgoCD continuous deployment reconciliation.

---

## 🛠️ Technology Stack Summary

The platform uses a modern, multi-language stack divided into logical layers:

| Layer | Technology | Primary Role / Rationale |
|---|---|---|
| **Ingestion** | PostgreSQL WAL + Debezium | Real-time logical CDC ingestion. Bypasses query-based database overhead. |
| **Backbone** | Apache Kafka (Strimzi Operator) | Event streaming backbone. Enforces schema evolution and provides offset replays. |
| **Governance**| Confluent Schema Registry | Central schema catalog. Enforces Avro schema compatibility rules. |
| **Processing**| Apache Spark (Spark Operator) | Distributed Structured Streaming engine for enrichment, joins, and classifications. |
| **Vector Engine**| NVIDIA API Gateway / llama.cpp | Centralized embedding retrieval (BGE-M3 model, 3584-dimension vector). |
| **Data Store**| PostgreSQL (CloudNativePG) | Relational system of record. Stores curated dimensions and cleaned articles. |
| **Feed Store** | Redis Cache | In-memory key-value card cache and sorted set feed indexes. |
| **Search Engine**| Elasticsearch | Keyword search engine. Provides multi-field matching indexes. |
| **Vector DB** | Qdrant | Vector database. Indexes embeddings and payloads for hybrid semantic search. |
| **Backend** | Spring Boot WebFlux (Netty) | Reactive, non-blocking REST API layer (Mono/Flux pipelines). |
| **Frontend** | Next.js 15 (React 19 + Tailwind 4) | User interface implementing the high-contrast Editorial Paper theme. |
| **API Gateway**| Kong API Gateway (KGO) | Kubernetes Gateway API proxy. Routes external traffic to backend/frontend. |
| **Observability**| ClickStack + OTel Collector | OLAP telemetry collection (HyperDX + ClickHouse + MongoDB). |
| **CI/CD** | Jenkins + ArgoCD | Dynamic build automation (CI) and GitOps application sync (CD). |

---

## ⚙️ Deployment Strategy (Local Dev vs. Kubernetes)

The platform is designed to be fully cloud-native. To facilitate local development and cluster deployments, configurations are structured into two environments:

1.  **Local Development (`docker-compose`):**
    *   Exposes services locally using named profiles (e.g. `source`, `backbone`, `serving`, `ui`, `processing`).
    *   Utilized by developers to test individual services or run code edits with hot reloading.
2.  **Production Deployment (Kubernetes / Helm):**
    *   All workloads described in docker-compose map onto standard Kubernetes resources within a 3-node **K3s** cluster.
    *   Infrastructure operations are managed declaratively using **Helm Charts** and custom CRDs watched by operators. 
    *   If a service runs under a compose profile locally, it is deployed as an operator-managed cluster in the Kubernetes namespace (`imperium-news-ns`) (e.g., PostgreSQL runs under CloudNativePG cluster, Kafka runs under Strimzi Kafka cluster, Spark runs as a `SparkApplication` resource, and Kong manages proxy DP pods).

---

## 🔗 Code Reference Links

To explore the codebase directly, reference the following directories and configurations:
*   **Backend Source Code:** [backend/news-app](file:///home/anouar.zerrik/projects/pfe/imperium-news-streaming-platform/backend/news-app)
*   **Frontend Source Code:** [frontend](file:///home/anouar.zerrik/projects/pfe/imperium-news-streaming-platform/frontend)
*   **Spark Ingestion & Processing:** [apps/processing/news-pipeline](file:///home/anouar.zerrik/projects/pfe/imperium-news-streaming-platform/apps/processing/news-pipeline)
*   **Python Projector Scripts:** [apps/processing/news-pipeline/jobs/projections](file:///home/anouar.zerrik/projects/pfe/imperium-news-streaming-platform/apps/processing/news-pipeline/jobs/projections)
*   **Helm Configurations (Infrastructure Repo):** [imperium-streaming-news-processing](file:///home/anouar.zerrik/projects/pfe/imperium-helm-k8s-infra/imperium-streaming-news-processing)
*   **Kubernetes Batch & Cron Jobs:** [jobs/](file:///home/anouar.zerrik/projects/pfe/imperium-helm-k8s-infra/jobs)
*   **Jenkins CI Pipeline Configuration:** [Jenkins-pipelines/](file:///home/anouar.zerrik/projects/pfe/imperium-helm-k8s-infra/Jenkins-pipelines)
