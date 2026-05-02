import os
from diagrams import Diagram, Cluster, Edge
from diagrams.custom import Custom
from diagrams.onprem.database import PostgreSQL
from diagrams.onprem.queue import Kafka
from diagrams.onprem.network import Zookeeper
from diagrams.onprem.compute import Server

# ── Graph-level styling ─────────────────────────────────────────────────────
graph_attr = {
    "fontsize": "13",
    "fontname": "Helvetica Neue",
    "bgcolor": "white",
    "pad": "0.8",
    "splines": "ortho",
    "nodesep": "0.7",
    "ranksep": "1.2",
    "labelloc": "t",
    "label": "Imperium News Platform — Ingestion Stage",
}

cluster_source = {"bgcolor": "#EBF5FB", "style": "rounded,filled", "fontcolor": "#154360", "pencolor": "#154360"}
cluster_connect = {"bgcolor": "#FEF9E7", "style": "rounded,filled", "fontcolor": "#784212", "pencolor": "#784212"}
cluster_schema  = {"bgcolor": "#EAFAF1", "style": "rounded,filled", "fontcolor": "#145A32", "pencolor": "#145A32"}
cluster_kafka   = {"bgcolor": "#FDF2F8", "style": "rounded,filled", "fontcolor": "#4A235A", "pencolor": "#4A235A"}
cluster_backfill = {"bgcolor": "#FDFEFE", "style": "rounded,dashed", "fontcolor": "#616A6B", "pencolor": "#616A6B"}

# Icon paths (absolute)
current_dir = os.path.dirname(os.path.abspath(__file__))
assets_dir = os.path.join(current_dir, "..")
debezium_icon = os.path.join(assets_dir, "Debezium-900x900-1.png")
schema_reg_icon = os.path.join(assets_dir, "confluent-schema-reistry-logo.png")
topic_icon = os.path.join(assets_dir, "topic-queue.png")

# ── Edge style helpers ───────────────────────────────────────────────────────
FLOW    = Edge(color="#1a73e8", style="bold")
WAL     = Edge(color="#1a73e8", style="bold",   label="WAL / pgoutput\nlogical replication")
AVRO    = Edge(color="#7B1FA2", style="bold",   label="Avro binary\n(5-byte schema_id prefix)")
SCHEMA  = Edge(color="#34a853", style="dashed", label="register schema\nfetch schema_id")
SIGNAL  = Edge(color="#f57c00", style="dashed", label="execute-snapshot\nsignal (row INSERT)")
BACKFILL= Edge(color="#f57c00", style="dashed", label="triggers snapshot")

with Diagram(
    "Ingestion Stage",
    show=False,
    filename="../ingestion_arch",
    direction="LR",
    outformat="png",
    graph_attr=graph_attr,
):
    # ── SOURCE LAYER ─────────────────────────────────────────────────────────
    with Cluster("Source Layer — PostgreSQL 13\n(WAL logical replication enabled)", graph_attr=cluster_source):
        tbl_news = PostgreSQL("public.table_news\n(news articles)")
        tbl_dim  = PostgreSQL("public.table_links\npublic.table_authority\npublic.table_sedition\npublic.table_pays\npublic.table_langue\npublic.table_rubrique")
        tbl_sig  = PostgreSQL("public.debezium_signal\n(backfill trigger table)")

    # ── KAFKA CONNECT / CDC LAYER ─────────────────────────────────────────────
    with Cluster("CDC Layer — Kafka Connect (Debezium 2.x)\nDebezium PostgreSQL Connector", graph_attr=cluster_connect):
        news_conn = Custom("news-connector\nslot: NEWS_CDC_SLOT_NAME\npub: NEWS_CDC_PUBLICATION_NAME", debezium_icon)
        meta_conn = Custom("metadata-connector\n6 dimension tables", debezium_icon)
        ref_conn  = Custom("reference-connector", debezium_icon)

    # ── SCHEMA REGISTRY ───────────────────────────────────────────────────────
    with Cluster("Schema Management\nKarapace Schema Registry :8081", graph_attr=cluster_schema):
        schema_reg = Custom("Karapace\nSchema Registry", schema_reg_icon)

    # ── KAFKA OUTPUT TOPICS ───────────────────────────────────────────────────
    with Cluster("Kafka Cluster — KRaft (2 brokers)\nOutput Topics", graph_attr=cluster_kafka):
        t_news  = Kafka("imperium.news.public.table_news\nAvro CDC envelope")
        t_links = Kafka("imperium.news.public.table_links")
        t_auth  = Kafka("imperium.news.public.table_authority")
        t_sed   = Kafka("imperium.news.public.table_sedition")
        t_pays  = Kafka("imperium.news.public.table_pays")
        t_lang  = Kafka("imperium.news.public.table_langue")
        t_rub   = Kafka("imperium.news.public.table_rubrique")

    with Cluster("Internal Kafka Topics\n(compacted — not consumed downstream)", graph_attr=cluster_backfill):
        t_hist = Kafka("schema-history-*\n(Debezium internal)")
        t_hb   = Kafka("debezium-heartbeat-*\ndebezium-signal-*")

    # ── DATA FLOW EDGES ───────────────────────────────────────────────────────
    # Source → CDC connectors (WAL)
    tbl_news >> Edge(color="#1a73e8", style="bold", label="WAL / pgoutput\nlogical replication") >> news_conn
    tbl_dim  >> Edge(color="#1a73e8", style="bold", label="WAL / pgoutput\nlogical replication") >> meta_conn
    tbl_dim  >> Edge(color="#1a73e8", style="bold", label="WAL / pgoutput") >> ref_conn

    # Backfill signal
    tbl_sig >> Edge(color="#f57c00", style="dashed", label="execute-snapshot\nsignal (row INSERT)") >> news_conn
    tbl_sig >> Edge(color="#f57c00", style="dashed", label="execute-snapshot\nsignal") >> meta_conn

    # CDC → Schema Registry (bidirectional: register on produce, fetch on consume)
    news_conn >> Edge(color="#34a853", style="dashed", label="register Avro schema\nget schema_id") >> schema_reg
    meta_conn >> Edge(color="#34a853", style="dashed", label="register Avro schema\nget schema_id") >> schema_reg

    # CDC → Kafka output topics
    news_conn >> Edge(color="#7B1FA2", style="bold", label="Avro binary\n5-byte Confluent wire format") >> t_news
    meta_conn >> Edge(color="#7B1FA2", style="bold", label="Avro binary\n{before, after, op, source}") >> t_links
    meta_conn >> Edge(color="#7B1FA2", style="bold") >> t_auth
    meta_conn >> Edge(color="#7B1FA2", style="bold") >> t_sed
    meta_conn >> Edge(color="#7B1FA2", style="bold") >> t_pays
    meta_conn >> Edge(color="#7B1FA2", style="bold") >> t_lang
    meta_conn >> Edge(color="#7B1FA2", style="bold") >> t_rub
    ref_conn  >> Edge(color="#7B1FA2", style="bold", label="Avro binary") >> t_rub

    # Internal
    news_conn >> Edge(color="#9E9E9E", style="dotted", label="schema changelog") >> t_hist
    news_conn >> Edge(color="#9E9E9E", style="dotted", label="heartbeat / signal ACK") >> t_hb
