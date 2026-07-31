# 09 - System Observability & ClickStack Architecture

## 1. Observability Framework Overview

In a distributed, event-driven streaming platform, visibility into the state of the network, messaging buffers, processing jobs, and databases is vital. The platform implements a unified observability stack powered by the **OpenTelemetry (OTel)** standard and the **ClickStack** telemetry platform.

Telemetry data is categorized into three main categories (M.E.L.T.):
1.  **Metrics:** Numeric measurements collected over time (e.g. JVM memory, Spark processing rate, Kafka topic lag, Redis hit rate).
2.  **Logs:** Structured text messages emitted by applications (JSON format).
3.  **Traces:** Distributed spans tracking the lifecycle of an HTTP request or event propagation through the pipeline (e.g. tracking a user request from Kong Gateway to the Spring Boot backend, down to Redis or PostgreSQL).

---

## 2. ClickStack Observability Architecture

**ClickStack** is an open-source, production-ready observability platform that aggregates telemetry and provides search, analysis, and visualization.

```
                  ┌──────────────────────────────────────────────┐
                  │          Kubernetes Pod / Workload           │
                  │ (Frontend, Backend, Spark, Projectors, etc)  │
                  └──────────────────────┬───────────────────────┘
                                         │ Emits logs/metrics/traces
                                         ▼
                  ┌──────────────────────────────────────────────┐
                  │       OpenTelemetry Collector Deployment     │
                  └──────────────────────┬───────────────────────┘
                                         │ Exporters: clickhouse
                                         ▼
                  ┌──────────────────────────────────────────────┐
                  │       ClickHouse Data Cluster (OLAP)         │
                  │    - Table: otel_logs                        │
                  │    - Table: otel_metrics                     │
                  │    - Table: otel_traces                      │
                  └──────────────────────▲───────────────────────┘
                                         │ Reads telemetry
                  ┌──────────────────────┴───────────────────────┐
                  │                  HyperDX UI                  │
                  │      (Dashboard & Alerting Interface)        │
                  └──────────────────────────────────────────────┘
```

### Components of ClickStack
*   **ClickHouse Cluster:** An OLAP (Online Analytical Processing) column-oriented database that functions as the central storage repository for all telemetry. ClickHouse can store billions of log entries and trace spans, compressing data up to 5x compared to standard row-oriented databases and executing analytical aggregates in milliseconds.
*   **HyperDX Service:** The user-facing observability dashboard. It provides an integrated interface to search logs (using Lucene syntax), trace API requests across microservices, and design dashboards.
*   **MongoDB Operator:** Provisions a MongoDB instance dedicated to storing HyperDX operational states, user accounts, alert rules, and dashboard JSON configurations.

---

## 3. OpenTelemetry Collector Pipeline Configuration

The **OpenTelemetry Collector** is deployed as a cluster-wide service. It acts as a proxy that receives telemetry, processes it (batching, attribute enrichment, memory limiting), and exports it to the target backend.

### Collector Pipelines (`values.yaml` Config)
The collector defines pipelines that wire receivers, processors, and exporters:
1.  **Logs Pipeline:**
    *   *Receiver:* OTLP (gRPC/HTTP)
    *   *Processor:* Memory Limiter (prevents collector crashes), Batching (groups logs into blocks of 8192 records to optimize ClickHouse inserts).
    *   *Exporter:* `clickhouse` (writes to `default.otel_logs` table).
2.  **Metrics Pipeline:**
    *   *Receiver:* OTLP, Prometheus (scrapes metrics from application endpoints, including Spring Boot Actuator).
    *   *Processor:* Memory Limiter, Batching.
    *   *Exporter:* `clickhouse` (writes to `default.otel_metrics` table).
3.  **Traces Pipeline:**
    *   *Receiver:* OTLP, Jaeger, Zipkin.
    *   *Processor:* Memory Limiter, Batching.
    *   *Exporter:* `clickhouse` (writes to `default.otel_traces` table).
4.  **Redis Metrics Pipeline:**
    *   *Receiver:* Custom `redis` receiver (polls metrics from the Redis server including memory usage, client counts, and command stats).
    *   *Exporter:* `clickhouse`.

---

## 4. Key Platform Metrics & Alerts

The platform leverages metrics exported to Prometheus and clickhouse to monitor pipeline health:

*   **Kafka Lag (`kafka_consumergroup_lag`):** Measures the difference between the latest offset committed by the database and the offsets consumed by the projectors or Spark jobs. High lag triggers alerts indicating processor slow-downs.
*   **Spark Micro-Batch Duration:** Tracks how long a Spark Structured Streaming batch takes to execute. If the batch duration exceeds the trigger processing time (e.g. 10 seconds), the pipeline is running behind real-time.
*   **Redis Cache Hit Rate:** Calculated as:
    $$\text{Hit Rate} = \frac{\text{keyspace\_hits}}{\text{keyspace\_hits} + \text{keyspace\_misses}}$$
    Ensures that Spring Boot is successfully resolving article detail calls from Redis memory rather than overloading PostgreSQL.
*   **Embedding Gateway Latency:** Measures response latency from the NVIDIA / local `llama-cpp` services to warn of rate-limiting throttling.
