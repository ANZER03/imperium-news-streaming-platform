#!/usr/bin/env bash

set -euo pipefail

source "$(dirname "$0")/processing-lib.sh"

services="${PROCESSING_SERVICES:-imperium-dimension-driver imperium-canonical-driver imperium-classification-driver imperium-redis-projector imperium-postgres-projector imperium-qdrant-projector}"
read -r -a service_array <<< "${services}"
compose logs -f "${service_array[@]}"
