#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "${ROOT_DIR}/scripts/lib/processing.sh"

services="${PROCESSING_SERVICES:-imperium-canonical-enrichment-driver imperium-classification-driver imperium-redis-projector imperium-postgres-projector imperium-qdrant-projector}"
read -r -a service_array <<< "${services}"
compose logs -f "${service_array[@]}"
