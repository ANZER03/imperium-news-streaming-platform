from diagrams import Diagram, Cluster, Edge
from diagrams.onprem.database import PostgreSQL
from diagrams.onprem.queue import Kafka
from diagrams.onprem.analytics import Spark
from diagrams.onprem.compute import Server
from diagrams.programming.language import Python

# ── Graph-level styling ─────────────────────────────────────────────────────
graph_attr = {
    "fontsize": "13",
    "fontname": "Helvetica Neue",
    "bgcolor": "white",
    "pad": "0.8",
    "splines": "ortho",
    "nodesep": "0.8",
    "ranksep": "1.4",
    "labelloc": "t",
    "label": "Imperium News Platform — Processing Stage",
}

cluster_input    = {"bgcolor": "#FDF2F8", "style": "rounded,filled", "fontcolor": "#4A235A", "pencolor": "#4A235A"}
cluster_dim      = {"bgcolor": "#EBF5FB", "style": "rounded,filled", "fontcolor": "#154360", "pencolor": "#154360"}
cluster_article  = {"bgcolor": "#FEF9E7", "style": "rounded,filled", "fontcolor": "#784212", "pencolor": "#784212"}
cluster_proj     = {"bgcolor": "#EAFAF1", "style": "rounded,filled", "fontcolor": "#145A32", "pencolor": "#145A32"}
cluster_ai       = {"bgcolor": "#F5EEF8", "style": "rounded,filled", "fontcolor": "#512E5F", "pencolor": "#512E5F"}
cluster_pg       = {"bgcolor": "#EBF5FB", "style": "rounded,filled", "fontcolor": "#154360", "pencolor": "#154360"}
cluster_output   = {"bgcolor": "#FDEDEC", "style": "rounded,filled", "fontcolor": "#641E16", "pencolor": "#641E16"}

with Diagram(
    "Processing Stage",
    show=False,
    filename="../processing_arch",
    direction="TB",
    outformat="svg",
    graph_attr=graph_attr,
):
    # ── KAFKA INPUT TOPICS ────────────────────────────────────────────────────
    with Cluster("Kafka Input Topics\n(produced by Ingestion Stage)", graph_attr=cluster_input):
        t_dim_in  = Kafka("imperium.news.public.<dim_table>\nAvro CDC envelope — 6 dimension tables")
        t_news_in = Kafka("imperium.news.public.table_news\nAvro CDC envelope — news articles")

    # ── SPARK PROCESSING LAYER ────────────────────────────────────────────────
    with Cluster("Spark 3.5.3 — PySpark Streaming (6 Independent Driver Containers)", graph_attr={"bgcolor": "#F8F9FA", "style": "rounded,filled", "fontcolor": "#212529", "pencolor": "#ADB5BD"}):

        with Cluster("Stage 1 — Dimension Materialization\ntrigger: every 15s", graph_attr=cluster_dim):
            job_dim = Spark("phase3_dimension_materializer_runtime\ndimensions.py + dimension_runtime_jobs.py")

        with Cluster("Stage 2 — Canonical Article Pipeline\ntrigger: every 5s (fastest — low-latency ingest)", graph_attr=cluster_article):
            job_can = Spark("phase3_canonical_pending_runtime\ncanonical.py + pending_feed_runtime.py\n→ enriches: country, source, language, rubric\n→ emits status=enriched")

        with Cluster("Stage 3 — Embedding Classification\ntrigger: every 15s", graph_attr=cluster_ai):
            job_cls = Spark("phase3_classification_runtime\nclassification.py\n→ cosine-sim vs topic embeddings\n→ assigns root_topic, primary_topic\n→ emits status=classified")
            gw      = Python("embedding_gateway.py\nbatch ≤ 8191 items\n40 RPM sliding-window throttle\nexponential backoff + bisect retry")
            nvidia  = Server("NVIDIA API\nbaai/bge-m3 model\nPOST /v1/embeddings\nreturns float32[1024]")

        with Cluster("Stage 4 — Projection Fan-out\ntrigger: every 15s", graph_attr=cluster_proj):
            job_rp  = Spark("phase3_redis_pending_projector\nredis_projection.py\nfilter: status=enriched")
            job_rt  = Spark("phase3_redis_topics_projector\nredis_projection.py + projection_fanout.py\nfilter: status=classified")
            job_qd  = Spark("phase3_qdrant_projector_runtime\nqdrant_projection.py\nfilter: status=classified")

    # ── POSTGRESQL STORAGE ────────────────────────────────────────────────────
    with Cluster("PostgreSQL — Durable Storage", graph_attr=cluster_pg):
        pg_dim   = PostgreSQL("imperium_dim_*\n(6 dimension tables)\nlinks, authorities, seditions\ncountries, rubrics, languages")
        pg_art   = PostgreSQL("imperium_articles\nclassification_status:\nenriched | classified | failed")
        pg_tax   = PostgreSQL("imperium_topic_taxonomy\n+ imperium_topic_embeddings\n(Medtop, SHA-256 guarded)")
        pg_state = PostgreSQL("imperium_projection_state\narticle_id → (country_id, root_topic_id)\nreplay-safe fan-out state")

    # ── KAFKA OUTPUT TOPICS ───────────────────────────────────────────────────
    with Cluster("Kafka Output Topics\n(consumed by Storage Stage projectors)", graph_attr=cluster_output):
        t_can_out = Kafka("imperium.canonical-articles\nJSON CanonicalArticle\nstatus=enriched (Stage 2)\nstatus=classified (Stage 3)")
        t_dlq     = Kafka("imperium.canonical-articles.dlq\nfailed articles\n(empty title / body)")

    # ── OUTPUT TO STORAGE STORES ──────────────────────────────────────────────
    redis_out  = Server("Redis\n(feed ZSETs + article hashes)\n→ see Storage Stage")
    qdrant_out = Server("Qdrant\n(imperium_articles collection)\n1024-dim vectors\n→ see Storage Stage")

    # ── EDGES: INPUT → JOBS ───────────────────────────────────────────────────
    t_dim_in  >> Edge(color="#1a73e8", style="bold", label="readStream\nAvro decode via cdc.py + spark_cdc.py\nschema fetched from Karapace") >> job_dim
    t_news_in >> Edge(color="#1a73e8", style="bold", label="readStream\nAvro decode\n5-day MVP window filter") >> job_can

    # ── DIMENSION MATERIALIZATION ─────────────────────────────────────────────
    job_dim >> Edge(color="#34a853", style="bold", label="UPSERT\nis_active=False on op=delete") >> pg_dim

    # ── CANONICAL PIPELINE ────────────────────────────────────────────────────
    pg_dim  >> Edge(color="#f57c00", style="dashed", label="snapshot_for_many()\ncountry resolution chain\n(authority → sedition → country_id)") >> job_can
    job_can >> Edge(color="#34a853", style="bold",   label="UPSERT status=enriched\n(idempotent: skip if payload unchanged)") >> pg_art
    job_can >> Edge(color="#7B1FA2", style="bold",   label="CanonicalArticle JSON\nstatus=enriched\nroot_topic_id=None") >> t_can_out
    job_can >> Edge(color="#d93025", style="dashed", label="articles with\nempty title or body") >> t_dlq

    # ── CLASSIFICATION ────────────────────────────────────────────────────────
    t_can_out >> Edge(color="#1a73e8", style="bold",   label="filter status=enriched\nreadStream") >> job_cls
    pg_tax    >> Edge(color="#f57c00", style="dashed", label="load topic vectors at startup\nTopicTaxonomyService") >> job_cls
    job_cls   >> Edge(color="#512E5F", style="bold",   label="embed(title + first 30 body words)") >> gw
    gw        >> Edge(color="#512E5F", style="bold",   label="POST /v1/embeddings\nbatched requests") >> nvidia
    nvidia    >> Edge(color="#512E5F", style="bold",   label="float32[1024] per article") >> gw
    gw        >> Edge(color="#512E5F", style="bold",   label="EmbeddingGatewayResult") >> job_cls
    job_cls   >> Edge(color="#34a853", style="bold",   label="UPDATE status=classified\ncosine-sim → primary_topic, root_topic\nstore embedding vector") >> pg_art
    job_cls   >> Edge(color="#7B1FA2", style="bold",   label="CanonicalArticle JSON\nstatus=classified + float32[1024]") >> t_can_out

    # ── PROJECTION FAN-OUT ────────────────────────────────────────────────────
    t_can_out >> Edge(color="#1a73e8", style="bold",   label="filter status=enriched") >> job_rp
    t_can_out >> Edge(color="#1a73e8", style="bold",   label="filter status=classified") >> job_rt
    t_can_out >> Edge(color="#1a73e8", style="bold",   label="filter status=classified") >> job_qd

    job_rp >> Edge(color="#34a853", style="bold", label="HSET news:{id} card\nZADD feed:global\nZADD feed:country:{id}") >> redis_out
    job_rt >> Edge(color="#34a853", style="bold", label="ZADD feed:topic:{root_id}\nZADD feed:country:{c}:topic:{t}\nZREM stale memberships") >> redis_out
    job_rt >> Edge(color="#f57c00", style="dashed", label="SELECT prev state\nUPSERT new state\n(replay-safe skip)") >> pg_state
    job_qd >> Edge(color="#34a853", style="bold", label="upsert point\n{id, vector[1024], payload}") >> qdrant_out
