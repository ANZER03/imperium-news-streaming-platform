COMPOSE ?= docker-compose
FOUNDATION_PROFILE ?= foundation
PROCESSING_PROFILE ?= processing
ENV_FILE ?= .env
PROCESSING_SERVICES := imperium-canonical-enrichment-driver imperium-classification-driver imperium-redis-projector imperium-postgres-projector imperium-qdrant-projector

BACKEND_SERVICES := kafka kafka-broker-2 schema-registry news-source-db redis qdrant imperium-redis-projector imperium-postgres-projector imperium-qdrant-projector redis-ui
BACKEND_PROFILES := --profile backbone --profile source --profile serving --profile projectors --profile ui
BACKEND_APP_PROFILES := --profile backend-app
BACKEND_APP_SERVICE := news-app frontend

.PHONY: infra-config foundation-up foundation-down foundation-logs smoke-test \
        cdc-up cdc-down cdc-clean cdc-verify cdc-validate cdc-reset-and-verify \
        processing-config processing-down processing-clean processing-clean-full \
        processing-up processing-logs processing-validate processing-fresh-reset \
        source-db-init source-db-refresh source-db-temp-sink \
        clone-news clone-bulk clone-schedule seed-redis seed-import-csv \
        clean-all-from-source redis-projector-reset backend-up backend-down backend-logs \
        backend-app-up backend-app-down backend-app-logs

# ─── Infrastructure ────────────────────────────────────────────────────────────
infra-config:
	ENV_FILE=$(ENV_FILE) $(COMPOSE) --env-file $(ENV_FILE) config

processing-config:
	ENV_FILE=$(ENV_FILE) $(COMPOSE) --env-file $(ENV_FILE) \
	  --profile source --profile backbone --profile serving --profile processing config

# ─── CDC ───────────────────────────────────────────────────────────────────────
cdc-up:
	ENV_FILE=$(ENV_FILE) COMPOSE="$(COMPOSE)" bash scripts/cdc/up.sh

cdc-down:
	ENV_FILE=$(ENV_FILE) COMPOSE="$(COMPOSE)" bash scripts/cdc/down.sh

cdc-clean:
	ENV_FILE=$(ENV_FILE) COMPOSE="$(COMPOSE)" bash scripts/cdc/clean.sh

cdc-verify:
	ENV_FILE=$(ENV_FILE) COMPOSE="$(COMPOSE)" bash scripts/cdc/verify.sh

cdc-validate:
	ENV_FILE=$(ENV_FILE) COMPOSE="$(COMPOSE)" bash scripts/cdc/validate.sh

cdc-reset-and-verify: source-db-refresh cdc-clean cdc-up cdc-verify

# ─── Processing ────────────────────────────────────────────────────────────────
processing-down:
	ENV_FILE=$(ENV_FILE) COMPOSE="$(COMPOSE)" bash scripts/processing/down.sh

processing-clean:
	ENV_FILE=$(ENV_FILE) COMPOSE="$(COMPOSE)" bash scripts/processing/clean.sh

processing-clean-full:
	ENV_FILE=$(ENV_FILE) COMPOSE="$(COMPOSE)" bash scripts/processing/clean.sh --full

processing-up:
	ENV_FILE=$(ENV_FILE) COMPOSE="$(COMPOSE)" bash scripts/processing/up.sh

processing-fresh-reset:
	ENV_FILE=$(ENV_FILE) COMPOSE="$(COMPOSE)" bash scripts/processing/fresh-reset.sh

processing-logs:
	ENV_FILE=$(ENV_FILE) COMPOSE="$(COMPOSE)" PROCESSING_SERVICES="$(PROCESSING_SERVICES)" bash scripts/processing/logs.sh

processing-validate:
	ENV_FILE=$(ENV_FILE) COMPOSE="$(COMPOSE)" bash scripts/processing/validate.sh

# ─── Source DB ─────────────────────────────────────────────────────────────────
source-db-init:
	ENV_FILE=$(ENV_FILE) COMPOSE="$(COMPOSE)" bash scripts/source-db/init.sh

source-db-refresh:
	ENV_FILE=$(ENV_FILE) COMPOSE="$(COMPOSE)" bash scripts/source-db/refresh.sh

source-db-temp-sink:
	ENV_FILE=$(ENV_FILE) COMPOSE="$(COMPOSE)" bash scripts/source-db/temp-sink-setup.sh

# ─── Clone ─────────────────────────────────────────────────────────────────────
clone-news:
	python3 scripts/clone/clone-news.py $(ARGS)

clone-bulk:
	python3 scripts/clone/bulk.py $(ARGS)

clone-schedule:
	python3 scripts/clone/scheduler.py

# ─── Seed ──────────────────────────────────────────────────────────────────────
seed-redis:
	python3 scripts/seed/seed-redis.py $(ARGS)

seed-import-csv:
	python3 scripts/seed/import-csv.py $(ARGS)

# ─── Composite ─────────────────────────────────────────────────────────────────
clean-all-from-source: processing-clean-full source-db-refresh cdc-clean cdc-up cdc-verify

# ─── Foundation ────────────────────────────────────────────────────────────────
foundation-up:
	ENV_FILE=$(ENV_FILE) $(COMPOSE) --env-file $(ENV_FILE) --profile $(FOUNDATION_PROFILE) up -d

foundation-down:
	ENV_FILE=$(ENV_FILE) $(COMPOSE) --env-file $(ENV_FILE) --profile $(FOUNDATION_PROFILE) down

foundation-logs:
	ENV_FILE=$(ENV_FILE) $(COMPOSE) --env-file $(ENV_FILE) --profile $(FOUNDATION_PROFILE) logs -f

# ─── Backend ───────────────────────────────────────────────────────────────────
backend-up:
	$(COMPOSE) --env-file $(ENV_FILE) $(BACKEND_PROFILES) up -d $(BACKEND_SERVICES)

backend-down:
	$(COMPOSE) --env-file $(ENV_FILE) $(BACKEND_PROFILES) stop $(BACKEND_SERVICES)

backend-logs:
	$(COMPOSE) --env-file $(ENV_FILE) $(BACKEND_PROFILES) logs -f $(BACKEND_SERVICES)

backend-app-up:
	$(COMPOSE) --env-file $(ENV_FILE) $(BACKEND_APP_PROFILES) up -d --build $(BACKEND_APP_SERVICE)

backend-app-down:
	$(COMPOSE) --env-file $(ENV_FILE) $(BACKEND_APP_PROFILES) stop $(BACKEND_APP_SERVICE)

backend-app-logs:
	$(COMPOSE) --env-file $(ENV_FILE) $(BACKEND_APP_PROFILES) logs -f $(BACKEND_APP_SERVICE)

# ─── Utilities ─────────────────────────────────────────────────────────────────
smoke-test:
	bash scripts/smoke-test.sh

redis-projector-reset:
	@echo "==> Stopping redis projector..."
	$(COMPOSE) --profile projectors stop imperium-redis-projector
	@echo "==> Deleting Kafka consumer group..."
	@GROUP=$$(grep REDIS_PROJECTOR_GROUP_ID $(ENV_FILE) | cut -d= -f2); \
	docker exec imperium-kafka-1 kafka-consumer-groups \
	  --bootstrap-server kafka:29092 \
	  --group "$$GROUP" --delete 2>/dev/null || true; \
	echo "  Deleted group: $$GROUP"
	@echo "==> Bumping group ID in $(ENV_FILE)..."
	@CURRENT=$$(grep REDIS_PROJECTOR_GROUP_ID $(ENV_FILE) | cut -d= -f2); \
	BASE=$$(echo "$$CURRENT" | sed 's/-v[0-9]*$$//'); \
	VER=$$(echo "$$CURRENT" | grep -oE '[0-9]+$$'); \
	NEW="$$BASE-v$$((VER + 1))"; \
	sed -i "s/REDIS_PROJECTOR_GROUP_ID=.*/REDIS_PROJECTOR_GROUP_ID=$$NEW/" $(ENV_FILE); \
	echo "  $$CURRENT --> $$NEW"
	@echo "==> Flushing Redis..."
	docker exec imperium-redis redis-cli FLUSHALL
	@echo "==> Building redis projector image..."
	$(COMPOSE) --profile projectors build imperium-redis-projector
	@echo "==> Starting redis projector with new group..."
	$(COMPOSE) --env-file $(ENV_FILE) --profile projectors up -d imperium-redis-projector
	@echo "==> Done. Follow logs with: docker logs -f imperium-redis-projector"
