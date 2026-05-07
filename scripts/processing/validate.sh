#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "${ROOT_DIR}/scripts/lib/processing.sh"

echo "Source baseline:"
pg_exec -t -A <<'SQL'
SELECT 'table_news=' || COUNT(*) FROM public.table_news
UNION ALL
SELECT 'table_news_active=' || COUNT(*) FROM public.table_news WHERE NOT COALESCE(to_delete, false);
SQL

echo "Processing tables:"
pg_exec -t -A <<'SQL'
SELECT 'imperium_articles=' || COUNT(*) FROM public.imperium_articles
UNION ALL
SELECT 'imperium_projection_state=' || COUNT(*) FROM public.imperium_projection_state
UNION ALL
SELECT 'imperium_topic_taxonomy=' || COUNT(*) FROM public.imperium_topic_taxonomy
UNION ALL
SELECT 'imperium_topic_embeddings=' || COUNT(*) FROM public.imperium_topic_embeddings
UNION ALL
SELECT 'imperium_dim_links=' || COUNT(*) FROM public.imperium_dim_links
UNION ALL
SELECT 'imperium_dim_authorities=' || COUNT(*) FROM public.imperium_dim_authorities
UNION ALL
SELECT 'imperium_dim_seditions=' || COUNT(*) FROM public.imperium_dim_seditions
UNION ALL
SELECT 'imperium_dim_countries=' || COUNT(*) FROM public.imperium_dim_countries
UNION ALL
SELECT 'imperium_dim_rubrics=' || COUNT(*) FROM public.imperium_dim_rubrics
UNION ALL
SELECT 'imperium_dim_languages=' || COUNT(*) FROM public.imperium_dim_languages;
SQL

echo "Kafka processing topics:"
kafka_exec kafka-topics --bootstrap-server "${KAFKA_BOOTSTRAP}" --list | grep 'canonical-articles\|classified' || true

echo "Redis processing keys:"
echo "article_keys=$(redis_exec --scan --pattern 'article:*' | wc -l | tr -d ' ')"
echo "feed_keys=$(redis_exec --scan --pattern 'feed:*' | wc -l | tr -d ' ')"

echo "Qdrant collections:"
qdrant_request "${QDRANT_URL}/collections" | python3 -m json.tool 2>/dev/null || true
