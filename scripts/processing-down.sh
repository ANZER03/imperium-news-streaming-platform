#!/usr/bin/env bash

set -euo pipefail

source "$(dirname "$0")/processing-lib.sh"

compose --profile processing stop \
  imperium-dimension-driver \
  imperium-canonical-driver \
  imperium-classification-driver \
  imperium-redis-projector \
  imperium-postgres-projector \
  imperium-qdrant-projector || true

docker rm -f \
  imperium-phase3-dimension-driver \
  imperium-phase3-canonical-driver \
  imperium-phase3-classification-driver \
  imperium-phase3-redis-driver \
  imperium-phase3-redis-topics-driver \
  imperium-phase3-qdrant-driver \
  imperium-dimension-driver \
  imperium-canonical-driver \
  imperium-classification-driver \
  imperium-redis-projector \
  imperium-postgres-projector \
  imperium-qdrant-projector >/dev/null 2>&1 || true
