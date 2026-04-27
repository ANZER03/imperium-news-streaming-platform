#!/usr/bin/env bash

set -euo pipefail

source "$(dirname "$0")/processing-lib.sh"

compose --profile source --profile backbone --profile serving --profile processing up -d \
  kafka kafka-broker-2 schema-registry postgres-source redis qdrant spark-master spark-worker spark-worker-2 spark-worker-3 spark-history-server

compose --profile source --profile backbone --profile serving --profile processing up -d imperium-dimension-driver
compose --profile source --profile backbone --profile serving --profile processing up -d imperium-canonical-driver
compose --profile source --profile backbone --profile serving --profile processing up -d imperium-classification-driver
compose --profile source --profile backbone --profile serving --profile processing up -d imperium-redis-driver
compose --profile source --profile backbone --profile serving --profile processing up -d imperium-redis-topics-driver
compose --profile source --profile backbone --profile serving --profile processing up -d imperium-qdrant-driver
