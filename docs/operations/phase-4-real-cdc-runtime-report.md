# Phase 4 Real CDC Runtime Report

Date: 2026-04-26 UTC

## Scope

This report records the Phase 4 runtime proof for the real local path:

Debezium CDC Kafka topics -> Spark driver jobs -> PostgreSQL, Redis, Qdrant,
and canonical Kafka.

The goal of this run was not to wait for every backlog topic to finish. The
goal was to prove the live path works end to end on real topics and that the
drivers, stores, and contracts are correct while catch-up continues in the
background.

## Runtime Stack

Live runtime containers:

- `imperium-dimension-driver`
- `imperium-canonical-driver`
- `imperium-classification-driver`
- `imperium-redis-driver`
- `imperium-qdrant-driver`
- `imperium-spark-master`
- `imperium-spark-worker-1`
- `imperium-spark-worker-2`
- `imperium-spark-worker-3`
- `imperium-spark-history-server`
- `imperium-kafka-1`
- `imperium-kafka-2`
- `imperium-schema-registry`
- `imperium-kafka-connect`
- `imperium-news-source-db`
- `imperium-redis`
- `imperium-qdrant`

Spark cluster status:

- 3 alive workers
- 6 total cores
- active applications during validation:
  - `phase3-canonical-article-processor`
  - `phase3-classification-runtime`
  - `phase3-redis-projector`
  - `phase3-dimension-materializer`
  - `phase3-qdrant-projector-runtime`

## Runtime Changes Applied

### Dimension runtime

- Split the dimension materializer into three query groups:
  - `reference`
  - `authority`
  - `links`
- Each query group now has its own checkpoint.
- Links and authority now progress independently.
- Removed driver-side `collect()` for dimension processing.
- Dimension rows are written to PostgreSQL in bounded batches from Spark
  partitions.
- Dimension driver now runs with 2 Spark cores.

### Qdrant runtime

- Qdrant driver was moved to its own replay checkpoint root:
  - `/tmp/imperium/checkpoints/processing`
- Qdrant driver now starts from `earliest` on the canonical topic so it can
  backfill vectors from already-classified canonical events.
- Verified direct numeric point IDs and vector retrieval behavior.

## Real Topic Evidence

Real CDC topics present:

- `imperium.news.public.table_news`
- `imperium.metadata.public.table_links`
- `imperium.metadata.public.table_authority`
- `imperium.reference.public.table_pays`
- `imperium.reference.public.table_langue`
- `imperium.reference.public.table_rubrique`
- `imperium.reference.public.table_sedition`
- `imperium.canonical-articles`
- `imperium.canonical-articles.dlq`

Canonical topic offsets at validation time:

- `imperium.canonical-articles:0:2689`
- `imperium.canonical-articles:1:2719`
- `imperium.canonical-articles:2:2766`

Canonical event sample keys from the real topic:

- `news:564995178`
- `news:564995181`
- `news:564995182`

## Serving Store Evidence

### PostgreSQL

Phase 3 runtime tables were present and populated.

Key counts at validation time:

- `cleaned_articles = 5407`
- `dim_links = 2103990`
- `dim_authorities = 1863534`
- `dim_countries = 260`
- `dim_languages = 186`
- `dim_rubrics = 39300`
- `dim_seditions = 30601`
- `topic_taxonomy = 17`
- `topic_embeddings = 17`
- `projection_state = 0`

Notes:

- Small dimensions are complete.
- `links` and `authorities` are still catching up from large historical CDC
  offsets.
- The runtime path is active; full catch-up is not required for this report.

### Redis

Redis was reachable and serving article/feed data.

Observed feed keys:

- `feed:global`
- `feed:country:89`
- `feed:topic:300`
- `feed:country:89:topic:300`

Observed global feed members included:

- `news:565049785`
- `news:565049784`
- `news:565049783`
- `news:565049782`

### Qdrant

Collection:

- name: `imperium_articles`
- distance: `Cosine`
- vector size: `1024`

Observed collection progress:

- before replay fix: `points_count = 1`
- after replay fix during validation: `points_count = 72`

Qdrant replay driver evidence:

- consumed canonical topic from offset `0`
- logged real projection batches such as:
  - `phase3-qdrant-projector batch=2 projected=35 skipped=0`

## End-to-End Sample

Cross-store sample article:

- `article_id = news:564995203`
- `source_news_id = 564995203`

PostgreSQL proof:

- classified
- visible
- title: `“روبو” اتصالات المغرب يجوب أروقة المعرض الدولي للفلاحة بمكناس ويستقطب إعجاب الزوار`
- root topic: `Technology`
- primary topic: `Artificial Intelligence`

Redis proof:

- key exists: `article:news:564995203`
- global feed membership score exists:
  - `1776988800`

Qdrant direct lookup proof:

- point id exists: `564995203`
- payload contains:
  - `article_id = news:564995203`
  - `root_topic_id = 300`
  - `primary_topic_id = 301`
  - `language_id = 1`
  - `is_visible = true`

Qdrant vector retrieval proof:

- recommendation query using positive point `564995203` returned real neighbors
- example returned point:
  - `564995205`
  - score `0.6038517`

## Fresh Validation Article

Recent fully classified live runtime validation articles were present in
PostgreSQL and Redis, including:

- `news:565049785`
- `news:565049784`
- `news:565049783`

At report time, those latest validation rows were ahead of the Qdrant replay
cursor, which is expected while the replay driver backfills older canonical
events first.

## Status

Phase 4 runtime is working:

- real CDC topics are connected
- Spark jobs run as driver containers on the Spark cluster
- PostgreSQL is receiving and serving real processed rows
- Redis is receiving and serving real feed cards and memberships
- Qdrant is replaying and indexing real classified canonical events
- canonical Kafka contains real pending and classified events

## Known Gaps

- `dim_links` and `dim_authorities` are still catching up against large topic
  histories.
- `imperium_projection_state` is still `0`; replay/update cleanup state is not
  yet persisted by the live projectors.
- Qdrant replay is active but not fully caught up at report time.

These gaps do not block the statement that the real CDC-to-serving path works.
They do matter for later hardening and full backlog completion before broader
Phase 5 backend usage.
