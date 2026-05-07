#!/usr/bin/env bash
# Manage the temporary PostgreSQL sink used for Kafka Connect sink connector testing.
#
# Usage:
#   temp-sink-setup.sh              — start container AND register connectors
#   temp-sink-setup.sh --setup      — start container only
#   temp-sink-setup.sh --register   — register connectors only (container must already be running)

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "${ROOT_DIR}/scripts/lib/cdc.sh"

MODE="${1:-all}"

if [[ "${MODE}" != "--setup" && "${MODE}" != "--register" && "${MODE}" != "all" ]]; then
  echo "Usage: $0 [--setup | --register]" >&2
  exit 2
fi

TEMP_DB_CONTAINER="${TEMP_DB_CONTAINER:-imperium-sink-test-db}"
TEMP_DB_IMAGE="${TEMP_DB_IMAGE:-postgres:15}"
TEMP_DB_NETWORK="${TEMP_DB_NETWORK:-imperium-net}"
TARGET_PG_HOST="${TARGET_PG_HOST:-${TEMP_DB_CONTAINER}}"
TARGET_PG_PORT="${TARGET_PG_PORT:-5432}"
TARGET_PG_DATABASE="${TARGET_PG_DATABASE:-imperium_sink_test}"
TARGET_PG_USER="${TARGET_PG_USER:-sink_user}"
TARGET_PG_PASSWORD="${TARGET_PG_PASSWORD:-sink_password}"
TARGET_PG_EXTERNAL_PORT="${TARGET_PG_EXTERNAL_PORT:-35433}"

TEMPLATE_DIR="${ROOT_DIR}/apps/ingestion/sink-templates/temp-postgres"

# ─── Container setup ──────────────────────────────────────────────────────────
setup_container() {
  if ! docker ps -a --format '{{.Names}}' | grep -qx "${TEMP_DB_CONTAINER}"; then
    docker run -d \
      --name "${TEMP_DB_CONTAINER}" \
      --network "${TEMP_DB_NETWORK}" \
      -p "${TARGET_PG_EXTERNAL_PORT}:5432" \
      -e POSTGRES_DB="${TARGET_PG_DATABASE}" \
      -e POSTGRES_USER="${TARGET_PG_USER}" \
      -e POSTGRES_PASSWORD="${TARGET_PG_PASSWORD}" \
      "${TEMP_DB_IMAGE}"
  else
    docker start "${TEMP_DB_CONTAINER}" >/dev/null 2>&1 || true
  fi

  echo "Waiting for ${TEMP_DB_CONTAINER}..."
  until docker exec "${TEMP_DB_CONTAINER}" \
      pg_isready -U "${TARGET_PG_USER}" -d "${TARGET_PG_DATABASE}" >/dev/null 2>&1; do
    sleep 1
  done

  docker exec -i "${TEMP_DB_CONTAINER}" \
    psql -U "${TARGET_PG_USER}" -d "${TARGET_PG_DATABASE}" -v ON_ERROR_STOP=1 \
    < "${ROOT_DIR}/infrastructure/postgres/initdb/05_temp_sink_tables.sql"

  printf 'Temp sink DB ready at %s:%s/%s\n' \
    "${TARGET_PG_HOST}" "${TARGET_PG_PORT}" "${TARGET_PG_DATABASE}"
}

# ─── Connector registration ───────────────────────────────────────────────────
register_connectors() {
  export TARGET_PG_HOST TARGET_PG_PORT TARGET_PG_DATABASE TARGET_PG_USER TARGET_PG_PASSWORD
  export TEMP_SINK_REF_PAYS_NAME="${TEMP_SINK_REF_PAYS_NAME:-imperium-temp-sink-ref-pays}"
  export TEMP_SINK_REF_LANGUE_NAME="${TEMP_SINK_REF_LANGUE_NAME:-imperium-temp-sink-ref-langue}"
  export TEMP_SINK_REF_RUBRIQUE_NAME="${TEMP_SINK_REF_RUBRIQUE_NAME:-imperium-temp-sink-ref-rubrique}"
  export TEMP_SINK_REF_SEDITION_NAME="${TEMP_SINK_REF_SEDITION_NAME:-imperium-temp-sink-ref-sedition}"
  export TEMP_SINK_METADATA_AUTHORITY_NAME="${TEMP_SINK_METADATA_AUTHORITY_NAME:-imperium-temp-sink-meta-authority}"
  export TEMP_SINK_METADATA_LINKS_NAME="${TEMP_SINK_METADATA_LINKS_NAME:-imperium-temp-sink-meta-links}"
  export TEMP_SINK_NEWS_NAME="${TEMP_SINK_NEWS_NAME:-imperium-temp-sink-news}"

  for template in "${TEMPLATE_DIR}"/*.json; do
    payload="$(python3 - "${template}" <<'PY'
from pathlib import Path
from string import Template
import json, os, sys

content = Template(Path(sys.argv[1]).read_text()).substitute(os.environ)
print(json.dumps(json.loads(content), separators=(',', ':')))
PY
)"

    connector_name="$(PAYLOAD="${payload}" python3 <<'PY'
import json, os
print(json.loads(os.environ["PAYLOAD"])["name"])
PY
)"

    config_payload="$(PAYLOAD="${payload}" python3 <<'PY'
import json, os
print(json.dumps(json.loads(os.environ["PAYLOAD"])["config"], separators=(',', ':')))
PY
)"

    if curl -sf -o /dev/null "${CONNECT_URL}/connectors/${connector_name}"; then
      printf '%s' "${config_payload}" | curl -sf \
        -X PUT -H 'Content-Type: application/json' --data-binary @- \
        "${CONNECT_URL}/connectors/${connector_name}/config" >/dev/null
    else
      printf '%s' "${payload}" | curl -sf \
        -X POST -H 'Content-Type: application/json' --data-binary @- \
        "${CONNECT_URL}/connectors" >/dev/null
    fi

    printf 'Registered %s\n' "${connector_name}"
  done
}

# ─── Dispatch ─────────────────────────────────────────────────────────────────
case "${MODE}" in
  --setup)    setup_container ;;
  --register) register_connectors ;;
  all)        setup_container; register_connectors ;;
esac
