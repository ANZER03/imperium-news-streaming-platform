# 08 - Kubernetes Infrastructure & Helm Deployment

## 1. Kubernetes Cluster Architecture (K3s)

The platform is deployed on a lightweight, production-grade **K3s (Kubernetes)** cluster. K3s packages Kubernetes dependencies into a single binary, reducing resource footprints while maintaining compliance with standard Kubernetes APIs.

### Cluster Node Topology
The environment is structured as a 3-node cluster:
1.  **`k3s-server` (Control Plane):** Runs api-server, etcd datastore, controller-manager, and scheduler.
2.  **`k3s-agent-1` (Worker Node):** Hosts database replicas, Kafka brokers, and Spark executor pods.
3.  **`k3s-agent-2` (Worker Node):** Hosts API backend, frontend Next.js, Kong Gateway, and observability dashboards.

---

## 2. Helm Umbrella Chart Design

To manage the deployment of the entire streaming stack, the platform uses an **Umbrella Helm Chart** pattern (`imperium-streaming-news-processing`). 

Rather than deploying twenty separate services manually, the umbrella chart bundles all local subcharts and upstream dependencies into a single deployment configuration.

### Chart Dependency Tree (`Chart.yaml`)
*   **Upstream Dependencies:**
    *   `strimzi-kafka-operator` (Kafka management)
    *   `spark-operator` (PySpark application lifecycle)
    *   `clickstack` (HyperDX + MongoDB + OpenTelemetry)
*   **Local Subcharts (`file://` reference):**
    *   `charts/kafka-cluster` (Strimzi Kafka brokers)
    *   `charts/pg-cluster` (CloudNativePG instances)
    *   `charts/schema-registry` (Avro schema management)
    *   `charts/kafka-connect` (Debezium runtime)
    *   `charts/projectors/` (Redis, Postgres, Qdrant, Elasticsearch projectors)
    *   `charts/llama-cpp` (Local Gemma LLM server)
    *   `charts/imperium-news-app` (Spring Boot backend)
    *   `charts/imperium-frontend` (Next.js user UI)
    *   `charts/kong-gateway` (Kong proxy and operator)

---

## 3. Operator Topologies & Custom Resources

The infrastructure is largely declarative, leveraging the **Kubernetes Operator Pattern**. Operators watch the Kubernetes API and automatically provision, configure, and maintain resources.

```
┌─────────────────────────────────────────────────────────────┐
│                  Kubernetes API Server                      │
│  Custom Resources:                                          │
│  - SparkApplication  ──> watched by  Spark Operator         │
│  - Kafka, KafkaTopic ──> watched by  Strimzi Operator       │
│  - Cluster (Postgres)──> watched by  CloudNativePG Operator │
│  - Gateway, HTTPRoute──> watched by  Kong Gateway Operator  │
└─────────────────────────────────────────────────────────────┘
```

### Strimzi Kafka Operator
*   **Role:** Deploys and manages Kafka brokers and Zookeeper clusters.
*   **Custom Resources:**
    *   `Kafka`: Defines broker counts, storage configuration, listener endpoints (port 9092 for internal services).
    *   `KafkaTopic`: Declares topics dynamically (e.g. `phase3.canonical-articles` partitions and replication factors).

### CloudNativePG (CNPG) Operator
*   **Role:** Manages high-availability PostgreSQL clusters.
*   **Custom Resources:**
    *   `Cluster`: Defines replica configurations (primary and read replicas), physical volume size, database user credentials, and WAL archiving policies. CNPG handles automated failover and promotion of read-replicas.

### Spark Operator
*   **Role:** Automates submission and lifecycle management of Apache Spark applications.
*   **Custom Resources:**
    *   `SparkApplication`: Configures Spark version (3.5.3), driver and executor pod CPU/Memory requests, environment variables, main script location, and restart policies.

### Kong Gateway Operator (KGO)
*   **Role:** Orchestrates the deployment of the API Gateway.
*   **Custom Resources:**
    *   `GatewayClass` / `Gateway`: KGO watches these resources to auto-provision the Kong Admin API (ControlPlane) and Kong Proxy (DataPlane) deployment pods, bypassing manual configurations.

---

## 4. API Routing via Kong Gateway (Gateway API Standard)

The platform implements routing using the modern **Kubernetes Gateway API** standard, replacing legacy Ingress controllers.

*   **Ingress Point:** Incoming user traffic is routed to the LoadBalancer service (`dataplane-ingress-kong`), which binds port `80` (HTTP) and NodePort `31607`.
*   **Declarative Routing (`HTTPRoute`):** Routes are configured using separate `HTTPRoute` resources instead of bloated, provider-specific ingress annotations.
    *   **Backend Route:** Matches path prefix `/api` and forwards to the Spring Boot service (`imperium-news-app`) on port `8999`.
    *   **Frontend Route:** Matches path prefix `/` and forwards to the Next.js service (`imperium-frontend`) on port `3000`.

---

## 5. Local Registry Integration

During local development and CI/CD operations, container images (such as custom python projectors or the Next.js UI) are published to a **Local Container Registry** running inside the K3s cluster.

*   **Registry Access:** The registry is deployed under the `registry` namespace and exposed on NodePort `30500` (forwarding to port 5000 inside the registry pod).
*   **Configuration:** The K3s nodes are configured via `/etc/rancher/k3s/registries.yaml` to accept the local registry domain (`registry.registry.svc.cluster.local:5000`) without SSL verification, allowing seamless pod pulling.
*   **Push Workflow:**
    ```bash
    # 1. Port forward to local host
    kubectl port-forward svc/registry -n registry 30500:5000 &
    # 2. Tag and push custom image
    docker build -t localhost:30500/debezium-avro:1.1.4 -f Dockerfile .
    docker push localhost:30500/debezium-avro:1.1.4
    ```
