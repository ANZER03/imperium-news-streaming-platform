import os
from diagrams import Diagram, Cluster, Edge
from diagrams.custom import Custom
from diagrams.onprem.database import PostgreSQL
from diagrams.onprem.queue import Kafka
from diagrams.onprem.inmemory import Redis
from diagrams.onprem.analytics import Spark
from diagrams.onprem.database import Qdrant

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
    "label": "Imperium News Platform — Storage Stage",
}

cluster_input   = {"bgcolor": "#FDF2F8", "style": "rounded,filled", "fontcolor": "#4A235A", "pencolor": "#4A235A"}
cluster_proj    = {"bgcolor": "#FEF9E7", "style": "rounded,filled", "fontcolor": "#784212", "pencolor": "#784212"}
cluster_redis   = {"bgcolor": "#FDEDEC", "style": "rounded,filled", "fontcolor": "#641E16", "pencolor": "#641E16"}
cluster_qdrant  = {"bgcolor": "#F5EEF8", "style": "rounded,filled", "fontcolor": "#512E5F", "pencolor": "#512E5F"}
cluster_pg      = {"bgcolor": "#EBF5FB", "style": "rounded,filled", "fontcolor": "#154360", "pencolor": "#154360"}

# Icon paths (absolute)
current_dir = os.path.dirname(os.path.abspath(__file__))
assets_dir = os.path.join(current_dir, "..")
topic_icon = os.path.join(assets_dir, "topic-queue.png")

with Diagram(
    "Storage Stage",
    show=False,
    filename="../storage_arch",
    direction="LR",
    outformat="png",
    graph_attr=graph_attr,
):
    # ── KAFKA INPUT ───────────────────────────────────────────────────────────
    with Cluster("Kafka — imperium.canonical-articles\n(produced by Processing Stage)", graph_attr=cluster_input):
        t_enrich  = Kafka("status = enriched\narticle enriched, not yet classified\n(produced by Canonical Emit job)")
        t_classif = Kafka("status = classified\narticle classified + embedding ready\n(produced by Classification job)")

    # ── PROJECTOR JOBS ────────────────────────────────────────────────────────
    with Cluster("Spark Projector Jobs\n(3 independent driver containers, trigger: 15s)", graph_attr=cluster_proj):
        job_rp = Spark("phase3_redis_pending_projector\nredis_projection.py\nfilter: status=enriched\n→ writes article card + global feeds")
        job_rt = Spark("phase3_redis_topics_projector\nredis_projection.py + projection_fanout.py\nfilter: status=classified\n→ writes topic feeds + cleanup stale")
        job_qd = Spark("phase3_qdrant_projector_runtime\nqdrant_projection.py\nfilter: status=classified\n→ upserts vector point")

    # ── POSTGRESQL STATE ──────────────────────────────────────────────────────
    with Cluster("PostgreSQL — Projection State\n(replay safety + stale membership cleanup)", graph_attr=cluster_pg):
        pg_state = PostgreSQL("imperium_projection_state\narticle_id → (country_id, root_topic_id)\nversion / published_at")
        pg_art   = PostgreSQL("imperium_articles\nfull canonical article storage\nclassification_status, embedding_vector")

    # ── REDIS SERVING STORE ───────────────────────────────────────────────────
    with Cluster("Redis — Serving Store\n(primary data source for the API)", graph_attr=cluster_redis):
        r_hash = Redis("HSET news:{article_id}\ntitle, image_url, source_domain\ncountry_id, published_at_epoch\nexcerpt, url — feed card fields")
        r_glob = Redis("ZADD feed:global\nscore = published_at epoch\n→ all visible articles")
        r_ctry = Redis("ZADD feed:country:{country_id}\nscore = published_at epoch\n→ country-filtered feed (Phase 2 fallback)")
        r_topi = Redis("ZADD feed:topic:{root_topic_id}\nscore = published_at epoch\n→ topic-filtered feed")
        r_ctop = Redis("ZADD feed:country:{c}:topic:{t}\nscore = published_at epoch\n→ personalized feed (Phase 1 primary query)")
        r_user = Redis("HSET user:{id}:prefs\nSADD user:{id}:viewed (12-day TTL)\nSADD user:{id}:saved (no TTL)")

    # ── QDRANT VECTOR STORE ───────────────────────────────────────────────────
    with Cluster("Qdrant — Vector Store\n(semantic search + hybrid filtering)", graph_attr=cluster_qdrant):
        qd_col = Qdrant("Collection: imperium_articles\nvector_size=1024, distance=Cosine")
        qd_pt  = Qdrant("Point: { id=source_news_id (int)\nvector=float32[1024] (BGE-M3)\npayload: article_id, country_id\nroot_topic_id, primary_topic_id\nlanguage_id, published_at\nsource_domain, is_visible }")

    # ── EDGES: INPUT → PROJECTORS ─────────────────────────────────────────────
    t_enrich  >> Edge(color="#1a73e8", style="bold", label="readStream\nfilter status=enriched") >> job_rp
    t_classif >> Edge(color="#1a73e8", style="bold", label="readStream\nfilter status=classified") >> job_rt
    t_classif >> Edge(color="#1a73e8", style="bold", label="readStream\nfilter status=classified") >> job_qd

    # ── EDGES: PENDING PROJECTOR → REDIS ─────────────────────────────────────
    job_rp >> Edge(color="#d93025", style="bold", label="HSET news:{id}\narticle card fields") >> r_hash
    job_rp >> Edge(color="#d93025", style="bold", label="ZADD\nscore=published_at_epoch") >> r_glob
    job_rp >> Edge(color="#d93025", style="bold", label="ZADD\nscore=published_at_epoch") >> r_ctry

    # ── EDGES: TOPICS PROJECTOR → REDIS + PROJECTION STATE ───────────────────
    job_rt >> Edge(color="#34a853", style="bold", label="ZADD\nscore=published_at_epoch") >> r_topi
    job_rt >> Edge(color="#34a853", style="bold", label="ZADD\nscore=published_at_epoch") >> r_ctop
    job_rt >> Edge(color="#f57c00", style="dashed", label="if root_topic changed:\nZREM feed:topic:{prev_root_id}\nZREM feed:country:{c}:topic:{prev_t}") >> r_topi
    job_rt >> Edge(color="#f57c00", style="dashed", label="SELECT prev (country_id, root_topic_id)\ncheck if exact replay → skip\nUPSERT new state after both succeed") >> pg_state
    pg_state >> Edge(color="#f57c00", style="dashed", label="prev state\nfor stale ZREM") >> job_rt

    # ── EDGES: QDRANT PROJECTOR ───────────────────────────────────────────────
    job_qd >> Edge(color="#7B1FA2", style="bold", label="HTTP upsert point\n{id, vector[1024], payload}") >> qd_col
    qd_col - qd_pt

    # ── REFERENCE: PostgreSQL canonical store ─────────────────────────────────
    pg_art >> Edge(color="#9E9E9E", style="dotted", label="read by backend API\n(cache-aside fallback)") >> r_user


