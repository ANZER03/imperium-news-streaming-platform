from diagrams import Diagram, Cluster, Edge
from diagrams.onprem.database import PostgreSQL
from diagrams.onprem.inmemory import Redis
from diagrams.onprem.client import Client, Users
from diagrams.onprem.database import Qdrant
from diagrams.programming.framework import Spring
from diagrams.onprem.compute import Server

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
    "label": "Imperium News Platform — Backend Serving Stage",
}

cluster_client  = {"bgcolor": "#EBF5FB", "style": "rounded,filled", "fontcolor": "#154360", "pencolor": "#154360"}
cluster_api     = {"bgcolor": "#FEF9E7", "style": "rounded,filled", "fontcolor": "#784212", "pencolor": "#784212"}
cluster_hot     = {"bgcolor": "#FDEDEC", "style": "rounded,filled", "fontcolor": "#641E16", "pencolor": "#641E16"}
cluster_cold    = {"bgcolor": "#EBF5FB", "style": "rounded,filled", "fontcolor": "#154360", "pencolor": "#154360"}
cluster_vector  = {"bgcolor": "#F5EEF8", "style": "rounded,filled", "fontcolor": "#512E5F", "pencolor": "#512E5F"}

with Diagram(
    "Backend Serving Stage",
    show=False,
    filename="../backend_arch",
    direction="TB",
    outformat="svg",
    graph_attr=graph_attr,
):
    # ── CLIENT LAYER ──────────────────────────────────────────────────────────
    with Cluster("Client Layer", graph_attr=cluster_client):
        clients = Users("Mobile / Web Clients\nHTTP REST")

    # ── API LAYER ─────────────────────────────────────────────────────────────
    with Cluster("API Layer — Spring WebFlux :8999\n(fully reactive, non-blocking I/O)", graph_attr=cluster_api):
        feed_ctrl = Spring("FeedController\nGET /api/v1/feed\nGET /api/v1/feed/topic\nGET /api/v1/feed/latest\nPOST /api/v1/feed/views")
        art_ctrl  = Spring("ArticleController\nGET /api/v1/articles/{id}\nPOST|DELETE /users/{id}/bookmarks/{artId}\nGET /users/{id}/bookmarks")
        usr_ctrl  = Spring("UserController\nPOST /api/v1/users/onboard\n→ generates UUID\n→ stores prefs in Redis")
        srch_ctrl = Spring("SearchController\nGET /api/v1/search\n→ vector similarity via Qdrant\n+ payload filters")

    # ── HOT PATH — REDIS ──────────────────────────────────────────────────────
    with Cluster("Hot Path — Redis (Serving Store)\nAll feed queries served from here", graph_attr=cluster_hot):
        r_prefs  = Redis("HGET user:{id}:prefs\n→ {country_id, topic_ids[]}\nread at every feed request")
        r_feed   = Redis("ZREVRANGEBYSCORE WITHSCORES\nfeed:country:{c}:topic:{t}  [Phase 1]\nfeed:country:{c}            [Phase 2 fallback]\nscore = published_at epoch, cursor = score < T")
        r_viewed = Redis("SMEMBERS user:{id}:viewed\n12-day TTL\n→ filter already-seen articles")
        r_card   = Redis("HGETALL news:{id}\n→ feed card: title, image_url\nsource_domain, published_at\ncountry_id, excerpt, url")
        r_cache  = Redis("GET article:{id}\nfull article JSON — 24h TTL\ncache-aside (miss → PostgreSQL)")
        r_saved  = Redis("SADD / SREM user:{id}:saved\nno TTL — bookmark store")

    # ── COLD PATH — POSTGRESQL ────────────────────────────────────────────────
    with Cluster("Cold Path — PostgreSQL\n(cache-miss fallback only)", graph_attr=cluster_cold):
        pg_art = PostgreSQL("imperium_articles\nSELECT * WHERE article_id = $1\nfull body_text, all metadata\n→ result cached in Redis 24h")

    # ── VECTOR PATH — QDRANT ─────────────────────────────────────────────────
    with Cluster("Semantic Search — Qdrant", graph_attr=cluster_vector):
        qd = Qdrant("imperium_articles collection\nsearch(vector=query_embedding\nfilter={country_id, root_topic_id, ...}\nlimit=N, with_payload=True)")

    # ── CLIENT → API ──────────────────────────────────────────────────────────
    clients >> Edge(color="#1a73e8", style="bold", label="HTTP GET /feed?userId&cursor&limit") >> feed_ctrl
    clients >> Edge(color="#1a73e8", style="bold", label="HTTP GET /articles/{id}") >> art_ctrl
    clients >> Edge(color="#1a73e8", style="bold", label="HTTP POST /onboard\nHTTP POST /bookmarks") >> usr_ctrl
    clients >> Edge(color="#1a73e8", style="bold", label="HTTP GET /search?q=...") >> srch_ctrl

    # ── FEED CONTROLLER → REDIS (two-phase fan-out) ───────────────────────────
    feed_ctrl >> Edge(color="#d93025", style="bold",   label="[1] read user prefs\n(country_id, topic_ids[])") >> r_prefs
    feed_ctrl >> Edge(color="#d93025", style="bold",   label="[2] Phase 1: parallel ZREVRANGEBYSCORE\nper subscribed topic (Flux.flatMap)") >> r_feed
    feed_ctrl >> Edge(color="#f57c00", style="dashed", label="[3] Phase 2: country fallback\nif Phase 1 returned < limit articles") >> r_feed
    feed_ctrl >> Edge(color="#d93025", style="bold",   label="[4] filter seen articles") >> r_viewed
    feed_ctrl >> Edge(color="#d93025", style="bold",   label="[5] parallel HGETALL per article_id\nhydrate feed cards") >> r_card
    feed_ctrl >> Edge(color="#f57c00", style="dashed", label="[6] SADD user:{id}:viewed\nmark as seen") >> r_viewed

    # ── ARTICLE CONTROLLER → REDIS + PG ──────────────────────────────────────
    art_ctrl >> Edge(color="#d93025", style="bold",   label="GET article:{id}\ncheck Redis cache first") >> r_cache
    r_cache  >> Edge(color="#9E9E9E", style="dashed", label="cache MISS\nquery PostgreSQL") >> pg_art
    pg_art   >> Edge(color="#9E9E9E", style="dashed", label="SET article:{id}\ncache result 24h TTL") >> r_cache
    art_ctrl >> Edge(color="#f57c00", style="dashed", label="SADD / SREM\nuser:{id}:saved") >> r_saved

    # ── USER CONTROLLER → REDIS ───────────────────────────────────────────────
    usr_ctrl >> Edge(color="#34a853", style="bold", label="HSET user:{id}:prefs\n{country_id, topic_ids[]}") >> r_prefs

    # ── SEARCH CONTROLLER → QDRANT ────────────────────────────────────────────
    srch_ctrl >> Edge(color="#7B1FA2", style="bold", label="vector search\n+ payload filters\n(country_id, root_topic_id, published_at range)") >> qd
