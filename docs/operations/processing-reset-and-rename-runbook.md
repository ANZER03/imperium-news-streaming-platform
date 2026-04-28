# Processing Reset And Rename Runbook

Use the root `Makefile` targets to reset only the processing-owned state after
CDC, preserve the expensive curated dimensions and taxonomy assets, and restart
the live replay in a fixed order.

For a true from-source rebuild of both CDC and processing state, use
[`full-cdc-rebootstrap-runbook.md`](./full-cdc-rebootstrap-runbook.md).

## Targets

- `make processing-config`: render the compose config after the `imperium_*`
  rename.
- `make processing-down`: stop the processing drivers only.
- `make processing-clean`: rename preserved PostgreSQL assets in place, delete
  downstream processing state, recreate canonical topics, recreate the Qdrant
  collection, delete processing-only consumer groups/checkpoints, and preserve
  dimension checkpoints.
- `make processing-clean-full`: delete all processing-owned PostgreSQL state,
  canonical topics, Redis serving keys, Qdrant projection state, processing
  consumer groups, and processing checkpoints, then leave processing stopped.
- `make processing-up`: start backbone and serving dependencies, then restart
  the drivers in replay order.
- `make processing-reset-and-run`: run `down`, `clean`, `up`, then validation.
- `make processing-logs`: tail all processing driver logs.
- `make processing-validate`: print source baselines plus current processing
  table, topic, Redis, and Qdrant counts.

## What Gets Deleted

- Old processing driver containers if present
- Kafka topics:
  - `phase3.canonical-articles`
  - `phase3.canonical-articles.dlq`
  - `imperium.canonical-articles`
  - `imperium.canonical-articles.dlq`
- PostgreSQL rows:
  - `imperium_articles`
  - `imperium_projection_state`
- Redis keys:
  - `article:*`
  - `feed:*`
- Qdrant collections:
  - `phase3_articles`
  - `imperium_articles`
- Non-dimension Spark checkpoints under `/tmp/imperium/checkpoints/processing`
  plus the older mixed replay roots
- Processing-related Kafka consumer groups if any exist

## What Gets Preserved

- Source DB tables and Debezium offsets
- CDC source topics
- Curated dimensions renamed in place to:
  - `imperium_dim_links`
  - `imperium_dim_authorities`
  - `imperium_dim_seditions`
  - `imperium_dim_countries`
  - `imperium_dim_rubrics`
  - `imperium_dim_languages`
- Topic taxonomy and topic embeddings renamed in place to:
  - `imperium_topic_taxonomy`
  - `imperium_topic_embeddings`
- Dimension checkpoint namespace under `/tmp/imperium/checkpoints/dimensions`

## Restart Order

1. stop processing drivers
2. rename preserved tables/resources
3. clean downstream state
4. recreate only `imperium.canonical-articles` and
   `imperium.canonical-articles.dlq`
5. recreate `imperium_articles` in Qdrant
6. start backbone services if needed
7. start `imperium-dimension-reference-driver`
8. start `imperium-dimension-authority-driver`
9. start `imperium-dimension-links-driver`
10. start `imperium-canonical-driver`
11. start `imperium-classification-driver`
12. start `imperium-redis-driver`
13. start `imperium-redis-topics-driver`
14. start `imperium-qdrant-driver`

## Expected Validation Shape

- `table_news` and active `table_news` counts print first
- `imperium_dim_*`, `imperium_topic_taxonomy`, and
  `imperium_topic_embeddings` stay populated
- `imperium_articles` starts at `0` after cleanup, then grows during replay
- `imperium_projection_state` starts at `0`, then repopulates during replay
- only `imperium.canonical-articles` and `imperium.canonical-articles.dlq`
  remain for processing
- Redis `article:*` and `feed:*` keys return after replay
- Qdrant recreates `imperium_articles` and `points_count` grows during replay

## Stage Validation Order

1. Canonical only:
   `imperium_articles` grows and `imperium.canonical-articles` receives events.
2. Classification:
   classified rows grow and sample topic labels look sane.
3. Redis cards/global-country:
   `article:*` and base `feed:*` keys repopulate.
4. Redis topics/projection-state:
   topic feeds grow and `imperium_projection_state` starts filling.
5. Qdrant:
   `imperium_articles` exists and `points_count` grows.
