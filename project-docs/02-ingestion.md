# 02 - Change Data Capture Ingestion Pipeline

## 1. CDC Architecture & Logical Replication

To enable real-time ingestion without putting a heavy query load on the PostgreSQL source database, the platform uses **Change Data Capture (CDC)**. Instead of using periodic query-based polling (which misses intermediate updates and deletes, and scans tables repeatedly), CDC hooks directly into the database engine's transaction log.

### Postgres WAL & Logical Replication
Every modification (INSERT, UPDATE, DELETE) to a table in PostgreSQL is appended to the Write-Ahead Log (WAL) before it is applied to the data blocks. 
*   **Replica Identity:** To support replication of full row histories, tables targeted for CDC must configure their `REPLICA IDENTITY` (usually set to `DEFAULT` or `FULL`). `FULL` ensures that when an UPDATE or DELETE occurs, the WAL record contains the previous values of all columns, which is required for resolving down-stream state and projections.
*   **Logical Decoding:** Logical replication uses a decoding plugin (such as `pgoutput` or `decoderbufs`) to translate the binary WAL entries into logical changes containing SQL-like row modifications.
*   **Replication Slots:** Postgres replication slots are used to guarantee that the database does not discard WAL segments until they have been acknowledged by the consumer (Debezium), preventing data loss during network or service outages.

---

## 2. Debezium & Kafka Connect Configuration

The platform runs **Debezium** inside a containerized **Kafka Connect** cluster. Kafka Connect is a framework for scalably and reliably streaming data between Apache Kafka and other systems.

### Ingestion Setup on Kubernetes
In the Kubernetes infrastructure, the Debezium Postgres source connector is managed by the `kafka-connect-connectors` Helm subchart. It registers configuration payloads with the Kafka Connect API.

```
┌─────────────────┐        ┌─────────────────────────┐        ┌────────────────┐
│ Postgres WAL    │ ──(1)──> │ Debezium Connector Task │ ──(2)──> │ Schema Registry│
│ (Logical Slot)  │          │ (inside Kafka Connect)  │          │ (Avro Schema)  │
└─────────────────┘          └────────────┬────────────┘        └────────────────┘
                                          │
                                         (3) Publishes Avro payload
                                          ▼
                             ┌─────────────────────────┐
                             │    Kafka Raw Topic      │
                             │ (e.g. news.table_news)  │
                             └─────────────────────────┘
```

### Connector Configurations
The system defines specific connector instances to track database tables:
1.  **News Connector (`imperium-news-cdc`):** Tracks the high-throughput `table_news` containing raw news articles.
2.  **Metadata Connector (`imperium-metadata-cdc`):** Tracks tables containing context (e.g. `table_links`, `table_authority`).
3.  **Reference Connector (`imperium-reference-cdc`):** Tracks static reference dimensions (e.g. language, country, category tables).

#### Core Connector Parameters (Kafka Connect Schema)
The connectors are configured via JSON properties containing:
```json
{
  "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
  "tasks.max": "1",
  "database.hostname": "imperium-pg-rw",
  "database.port": "5432",
  "database.user": "debezium",
  "database.password": "debezium-secret",
  "database.dbname": "imperium",
  "database.server.name": "imperium",
  "plugin.name": "pgoutput",
  "table.include.list": "public.table_news,public.table_links,public.table_authority,public.table_pays,public.table_rubrique,public.table_langue,public.table_sedition",
  "key.converter": "io.confluent.connect.avro.AvroConverter",
  "key.converter.schema.registry.url": "http://imperium-streaming-news-processing-schema-registry:8081",
  "value.converter": "io.confluent.connect.avro.AvroConverter",
  "value.converter.schema.registry.url": "http://imperium-streaming-news-processing-schema-registry:8081"
}
```

---

## 3. Schema Governance & Confluent Schema Registry

To avoid runtime decoding exceptions and ensure strict structure enforcement, the ingestion layer implements **Schema Governance** using **Apache Avro** and the **Confluent Schema Registry**.

### Avro Serialization
Rather than serializing events into bloated, schema-less JSON payloads, Debezium converts database records into binary Avro format.
*   **Separation of Data and Schema:** Avro events contain only the raw binary data. The schema definitions are registered and cached in the Confluent Schema Registry.
*   **Payload Header:** Each Kafka message is prefixed with a 5-byte magic payload (1 byte magic number + 4 bytes schema ID). Consumers extract the schema ID, retrieve the schema from the registry (caching it locally), and decode the binary payload.

### Schema Evolution Policies
The Schema Registry enforces a **Backward Compatibility** model. 
*   **Rules of Evolution:** Fields can only be deleted if they have default values, and new fields must be optional (contain default values). This ensures that older Spark consumers can process events written under newer schemas without crashing.

---

## 4. Kafka Topic Topology & Partitioning Strategy

Debezium automatically publishes changes to distinct topics named after the source server and table.

### Topic Mapping
The raw CDC topics map directly to the PostgreSQL source tables:
*   `imperium.public.table_news`
*   `imperium.public.table_links`
*   `imperium.public.table_authority`
*   `imperium.public.table_pays`
*   `imperium.public.table_rubrique`
*   `imperium.public.table_langue`
*   `imperium.public.table_sedition`

### Partitioning & Message Keying
*   **Deterministic Keying:** Debezium automatically uses the source table's primary key (e.g. `id` of `table_news`) as the Kafka message key.
*   **Hashing Partition Strategy:** Kafka brokers hash the message key to select the target partition. Because the key is the database primary key, all updates, deletes, and inserts relating to a specific database record (e.g. news item #185292) are routed to the **same partition**.

---

## 5. Event Ordering Guarantees

Event ordering is critical for stream processing to avoid race conditions (e.g. processing an UPDATE before the corresponding INSERT, or processing an insert after a DELETE has occurred).

The platform guarantees strict **per-key event ordering** through three design principles:
1.  **Single-Writer WAL Slot:** PostgreSQL processes transactions sequentially in the WAL log, meaning the source changes are already strictly ordered.
2.  **Partition Pinning:** Because Kafka guarantees message ordering within a single partition, pinning all changes for a given record ID to the same partition preserves the database chronological sequence.
3.  **In-Flight Requests Cap:** The Debezium producer is configured with `max.in.flight.requests.per.connection = 1`. This prevents out-of-order delivery that can occur if request #1 fails and request #2 succeeds, as request #1 is retried after request #2 has already been committed to the broker.
