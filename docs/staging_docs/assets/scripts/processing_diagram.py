import os
from diagrams import Diagram, Cluster, Edge
from diagrams.custom import Custom
from diagrams.onprem.analytics import Spark
from diagrams.onprem.compute import Server
from diagrams.onprem.queue import Kafka

# ── Graph-level styling ─────────────────────────────────────────────────────
graph_attr = {
    "fontsize": "13",
    "fontname": "Helvetica Neue",
    "bgcolor": "white",
    "pad": "1.0",
    "splines": "ortho",
    "nodesep": "1.0",
    "ranksep": "1.5",
    "labelloc": "t",
    "label": "Imperium News Platform — Simplified Processing Stage",
}

# Icon paths (absolute)
current_dir = os.path.dirname(os.path.abspath(__file__))
assets_dir = os.path.join(current_dir, "..")
topic_icon = os.path.join(assets_dir, "topic-queue.png")

with Diagram(
    "Processing Stage",
    show=False,
    filename="../processing_arch",
    direction="LR",
    outformat="png",
    graph_attr=graph_attr,
):
    # ── KAFKA INPUT ───────────────────────────────────────────────────────────
    t_in = Kafka("Kafka Source Topics\n(Ingestion Output)")

    # ── SPARK PROCESSING CLUSTER ──────────────────────────────────────────────
    with Cluster("Spark Cluster — PySpark Streaming\n(6 Independent Driver Containers)"):
        d1 = Spark("Dimension Materializer")
        d2 = Spark("Canonical Pipeline")
        d3 = Spark("Embedding & Classif.")
        d4 = Spark("Redis & Qdrant Projectors")
        drivers = [d1, d2, d3, d4]

    # ── KAFKA OUTPUT / STORAGE ────────────────────────────────────────────────
    t_out = Kafka("Kafka Output Topics\n(Canonical Articles)")
    
    pg = Server("PostgreSQL\n(Durable State)")
    rd = Server("Redis\n(Serving Store)")
    qd = Server("Qdrant\n(Vector Store)")
    storage = [pg, rd, qd]

    # ── DATA FLOW ─────────────────────────────────────────────────────────────
    # Flow from input to each driver
    for d in drivers:
        t_in >> Edge(color="#1a73e8", style="bold", label="readStream") >> d
        
    # Flow from drivers to output topics
    for d in drivers:
        d >> Edge(color="#34a853", style="bold", label="writeStream") >> t_out
        
    # Flow from drivers to storage
    for d in drivers:
        for s in storage:
             d >> Edge(color="#7B1FA2", style="dashed") >> s
