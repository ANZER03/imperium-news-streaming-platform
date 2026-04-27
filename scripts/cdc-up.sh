#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "${ROOT_DIR}/scripts/cdc-lib.sh"

metadata_signal_before=0
metadata_signal_after=0
news_signal_before=0
news_signal_after=0
run_started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
metadata_signal_id="metadata-rebootstrap-$(date -u +%Y%m%dT%H%M%SZ)"
news_signal_id="news-rebootstrap-$(date -u +%Y%m%dT%H%M%SZ)"

compose --profile source --profile backbone up -d \
  kafka \
  kafka-broker-2 \
  schema-registry \
  postgres-source \
  kafka-connect >/dev/null
wait_for_connect_api

bash "${ROOT_DIR}/apps/ingestion/topic-bootstrap/reference/bootstrap-reference-topics.sh"
bash "${ROOT_DIR}/apps/ingestion/connector-bootstrap/reference/register-reference-connector.sh" --register
wait_for_connector_running "${REFERENCE_CDC_CONNECTOR_NAME}"

bash "${ROOT_DIR}/apps/ingestion/topic-bootstrap/metadata/bootstrap-metadata-topics.sh"
metadata_signal_before="$(topic_end_offset "${METADATA_CDC_SIGNAL_TOPIC}")"
metadata_data_topic="${METADATA_CDC_TOPIC_PREFIX:-imperium.metadata}.public.table_source"
metadata_data_offset="$(topic_end_offset "${metadata_data_topic}" 2>/dev/null || echo 0)"

bash "${ROOT_DIR}/apps/ingestion/connector-bootstrap/metadata/register-metadata-connector.sh" --register
wait_for_connector_running "${METADATA_CDC_CONNECTOR_NAME}"

if [[ "${metadata_signal_before}" -eq 0 ]] && [[ "${metadata_data_offset}" -eq 0 ]]; then
  CDC_SIGNAL_ID="${metadata_signal_id}" \
    bash "${ROOT_DIR}/apps/ingestion/connector-bootstrap/metadata/emit-full-backfill-signal.sh" --emit
  metadata_signal_after=$(wait_for_topic_offset_at_least "${METADATA_CDC_SIGNAL_TOPIC}" $((metadata_signal_before + 1)) 20 || echo 0)
  if [[ "${metadata_signal_after}" -lt $((metadata_signal_before + 1)) ]]; then
    printf 'Metadata signal topic %s expected offset %s after fresh emit, got %s.\n' "${METADATA_CDC_SIGNAL_TOPIC}" "$((metadata_signal_before + 1))" "${metadata_signal_after}" >&2
    exit 1
  fi
else
  printf 'Metadata signal topic %s has offset %s, data topic %s has offset %s. Skipping fresh snapshot emit to avoid duplication.\n' "${METADATA_CDC_SIGNAL_TOPIC}" "${metadata_signal_before}" "${metadata_data_topic}" "${metadata_data_offset}"
  metadata_signal_after="${metadata_signal_before}"
fi

bash "${ROOT_DIR}/apps/ingestion/topic-bootstrap/news/bootstrap-news-topics.sh"
news_signal_before="$(topic_end_offset "${NEWS_CDC_SIGNAL_TOPIC}")"
news_data_topic="${NEWS_CDC_TOPIC_PREFIX:-imperium.news}.public.table_news"
news_data_offset="$(topic_end_offset "${news_data_topic}" 2>/dev/null || echo 0)"

bash "${ROOT_DIR}/apps/ingestion/connector-bootstrap/news/register-news-connector.sh" --register
wait_for_connector_running "${NEWS_CDC_CONNECTOR_NAME}"

if [[ "${news_signal_before}" -eq 0 ]] && [[ "${news_data_offset}" -eq 0 ]]; then
  CDC_SIGNAL_ID="${news_signal_id}" \
    bash "${ROOT_DIR}/apps/ingestion/connector-bootstrap/news/emit-full-backfill-signal.sh" --emit
  news_signal_after=$(wait_for_topic_offset_at_least "${NEWS_CDC_SIGNAL_TOPIC}" $((news_signal_before + 1)) 20 || echo 0)
  if [[ "${news_signal_after}" -lt $((news_signal_before + 1)) ]]; then
    printf 'News signal topic %s expected offset %s after fresh emit, got %s.\n' "${NEWS_CDC_SIGNAL_TOPIC}" "$((news_signal_before + 1))" "${news_signal_after}" >&2
    exit 1
  fi
else
  printf 'News signal topic %s has offset %s, data topic %s has offset %s. Skipping fresh snapshot emit to avoid duplication.\n' "${NEWS_CDC_SIGNAL_TOPIC}" "${news_signal_before}" "${news_data_topic}" "${news_data_offset}"
  news_signal_after="${news_signal_before}"
fi

save_run_state <<EOF
RUN_STARTED_AT=${run_started_at}
METADATA_SIGNAL_TOPIC=${METADATA_CDC_SIGNAL_TOPIC}
METADATA_SIGNAL_ID=${metadata_signal_id}
METADATA_SIGNAL_OFFSET_BEFORE=${metadata_signal_before}
METADATA_SIGNAL_OFFSET_AFTER=${metadata_signal_after}
NEWS_SIGNAL_TOPIC=${NEWS_CDC_SIGNAL_TOPIC}
NEWS_SIGNAL_ID=${news_signal_id}
NEWS_SIGNAL_OFFSET_BEFORE=${news_signal_before}
NEWS_SIGNAL_OFFSET_AFTER=${news_signal_after}
EOF

echo "CDC topics bootstrapped, connectors registered in reference -> metadata -> news order, and fresh signals emitted exactly once."
