#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "${ROOT_DIR}/scripts/lib/processing.sh"

compose \
  --profile source --profile backbone --profile serving \
  --profile processing-infra up -d \
  kafka kafka-broker-2 schema-registry news-source-db \
  redis qdrant spark-master spark-worker-1 spark-worker-2 spark-worker-3

compose \
  --profile source --profile backbone --profile serving \
  --profile processing-infra --profile processing up -d \
  imperium-canonical-enrichment-driver \
  imperium-classification-driver \
  imperium-redis-projector \
  imperium-postgres-projector \
  imperium-qdrant-projector
