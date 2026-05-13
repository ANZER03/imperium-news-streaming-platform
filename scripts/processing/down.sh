#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "${ROOT_DIR}/scripts/lib/processing.sh"

docker rm -f \
  imperium-canonical-enrichment-driver \
  imperium-classification-driver \
  imperium-topic-embedding-driver \
  imperium-dimension-reference-driver \
  imperium-dimension-authority-driver \
  imperium-dimension-links-driver \
  imperium-redis-projector \
  imperium-postgres-projector \
  imperium-qdrant-projector >/dev/null 2>&1 || true

echo "Processing containers removed."
