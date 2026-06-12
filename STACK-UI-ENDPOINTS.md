# Imperium News Streaming Platform — Stack UIs

This document maps all web User Interfaces (UIs) exposed by the streaming platform services when running locally.

---

## 📊 Overview Table

| Service / UI | Category | External Host Port | Default Local URL | Credentials / Login Info (if any) |
| :--- | :--- | :--- | :--- | :--- |
| **Imperium News UI (Frontend)** | User Application | `3000` | [http://localhost:3000](http://localhost:3000) | *None (Anonymous)* |
| **Grafana** | Observability | `43001` | [http://localhost:43001](http://localhost:43001) | User: `admin`<br>Password: `grafana123` |
| **clickstack UI** | Observability | `48123` | [http://localhost:48123/clickstack](http://localhost:48123/clickstack) | User: `admin`<br>Password: `clickstack123` |
| **Kibana** | Observability | `45601` | [http://localhost:45601](http://localhost:45601) | *None (Auth disabled)* |
| **Kafka UI** | Data Pipeline | `48089` | [http://localhost:48089](http://localhost:48089) | *None (Anonymous)* |
| **Spark Master UI** | Data Pipeline | `48080` | [http://localhost:48080](http://localhost:48080) | *None (Anonymous)* |
| **Spark Worker 1 UI** | Data Pipeline | `48091` | [http://localhost:48091](http://localhost:48091) | *None* |
| **Spark Worker 2 UI** | Data Pipeline | `48092` | [http://localhost:48092](http://localhost:48092) | *None* |
| **Spark Worker 3 UI** | Data Pipeline | `48093` | [http://localhost:48093](http://localhost:48093) | *None* |
| **Spark Driver: Canonical Enrichment** | Data Pipeline | `48100` | [http://localhost:48100](http://localhost:48100) | *None* |
| **Spark Driver: Classification** | Data Pipeline | `48101` | [http://localhost:48101](http://localhost:48101) | *None* |
| **Spark Driver: Trending** | Data Pipeline | `44044` | [http://localhost:44044](http://localhost:44044) | *None* |
| **Postgres UI (Adminer)** | Database UI | `48084` | [http://localhost:48084](http://localhost:48084) | See [Adminer Login](#adminer-login-details) |
| **Redis UI (RedisInsight)** | Cache / Store UI | `48090` | [http://localhost:48090](http://localhost:48090) | *None (Auth disabled)* |
| **Qdrant Dashboard** | Vector DB UI | `46333` | [http://localhost:46333/dashboard](http://localhost:46333/dashboard) | *None (Auth disabled)* |

---

## 🛠️ Detailed UIs by Service Group

### 1. User Application Layer

| Service Name | Container Port | Host Port | Default Local URL | Description / Notes |
| :--- | :--- | :--- | :--- | :--- |
| **frontend** | `3000` | `3000` | [http://localhost:3000](http://localhost:3000) | Main user interface of the Imperium News platform. |

### 2. Observability & Analytics

| Service Name | Container Port | Host Port | Default Local URL | Credentials / Notes |
| :--- | :--- | :--- | :--- | :--- |
| **grafana** | `3000` | `43001` | [http://localhost:43001](http://localhost:43001) | **Username:** `admin`<br>**Password:** `grafana123`<br>Preconfigured dashboard and analytics visualization. |
| **clickstack** | `8123` | `48123` | [http://localhost:48123/clickstack](http://localhost:48123/clickstack) | ClickHouse observability web client.<br>**Username:** `admin`<br>**Password:** `clickstack123` |
| **kibana** | `5601` | `45601` | [http://localhost:45601](http://localhost:45601) | Elasticsearch dashboard interface. Security is disabled in dev. |

### 3. Databases & Cache Engines

| Service Name | Container Port | Host Port | Default Local URL | Description / Notes |
| :--- | :--- | :--- | :--- | :--- |
| **pg-ui** *(Adminer)* | `8080` | `48084` | [http://localhost:48084](http://localhost:48084) | Database client GUI. See login parameters below. |
| **redis-ui** *(RedisInsight)* | `5540` | `48090` | [http://localhost:48090](http://localhost:48090) | Redis GUI. Proxy authentication is disabled. |
| **qdrant** *(Dashboard)* | `6333` | `46333` | [http://localhost:46333/dashboard](http://localhost:46333/dashboard) | Web UI dashboard for inspecting Qdrant collections. |

#### Adminer Login Details

To connect Adminer to the local Postgres database, use these values in the login form:
*   **System:** `PostgreSQL`
*   **Server:** `news-source-db` (within docker net)
*   **Username:** `postgres`
*   **Password:** `postgres`
*   **Database:** `imperium-news-source`

### 4. Data Processing & Backbone (Kafka / Spark)

| Service Name | Container Port | Host Port | Default Local URL | Description / Notes |
| :--- | :--- | :--- | :--- | :--- |
| **kafka-ui** | `8080` | `48089` | [http://localhost:48089](http://localhost:48089) | Visualizes clusters, topics, schemas, and Connect tasks. |
| **spark-master** | `8080` | `48080` | [http://localhost:48080](http://localhost:48080) | Spark cluster master manager interface. |
| **spark-worker** | `8081` | `48091` | [http://localhost:48091](http://localhost:48091) | UI for Spark Worker 1. |
| **spark-worker-2** | `8081` | `48092` | [http://localhost:48092](http://localhost:48092) | UI for Spark Worker 2. |
| **spark-worker-3** | `8081` | `48093` | [http://localhost:48093](http://localhost:48093) | UI for Spark Worker 3. |
| **imperium-canonical-enrichment-driver** | `4040` | `48100` | [http://localhost:48100](http://localhost:48100) | Spark UI for the enrichment streaming application driver. |
| **imperium-classification-driver** | `4040` | `48101` | [http://localhost:48101](http://localhost:48101) | Spark UI for the classification streaming application driver. |
| **imperium-trending-driver** | `4040` | `44044` | [http://localhost:44044](http://localhost:44044) | Spark UI for the trending application driver. |
