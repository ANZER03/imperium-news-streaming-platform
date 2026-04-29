COMPOSE ?= docker-compose
FOUNDATION_PROFILE ?= foundation
PROCESSING_PROFILE ?= processing
ENV_FILE ?= .env
PROCESSING_SERVICES := imperium-dimension-driver imperium-canonical-enrichment-driver imperium-classification-driver imperium-redis-projector imperium-postgres-projector imperium-qdrant-projector

BACKEND_SERVICES := kafka kafka-broker-2 schema-registry postgres-source redis qdrant imperium-redis-projector imperium-postgres-projector imperium-qdrant-projector redis-ui
BACKEND_PROFILES := --profile backbone --profile source --profile serving --profile processing

.PHONY: infra-config foundation-up foundation-down foundation-logs smoke-test validate-reference-cdc validate-metadata-cdc validate-news-cdc source-db-refresh cdc-clean cdc-up cdc-verify cdc-reset-and-verify processing-config processing-down processing-clean processing-clean-full processing-up processing-reset-and-run processing-logs processing-validate clean-all-from-source redis-projector-reset backend-up backend-down backend-logs

infra-config:
	ENV_FILE=$(ENV_FILE) $(COMPOSE) --env-file $(ENV_FILE) config

processing-config:
	ENV_FILE=$(ENV_FILE) $(COMPOSE) --env-file $(ENV_FILE) --profile source --profile backbone --profile serving --profile processing config

processing-down:
	ENV_FILE=$(ENV_FILE) COMPOSE="$(COMPOSE)" bash scripts/processing-down.sh

processing-clean:
	ENV_FILE=$(ENV_FILE) COMPOSE="$(COMPOSE)" bash scripts/processing-clean.sh

processing-clean-full:
	ENV_FILE=$(ENV_FILE) COMPOSE="$(COMPOSE)" bash scripts/processing-clean.sh --full-reset

processing-up:
	ENV_FILE=$(ENV_FILE) COMPOSE="$(COMPOSE)" bash scripts/processing-up.sh

processing-reset-and-run:
	ENV_FILE=$(ENV_FILE) COMPOSE="$(COMPOSE)" bash scripts/processing-reset-and-run.sh

processing-logs:
	ENV_FILE=$(ENV_FILE) COMPOSE="$(COMPOSE)" PROCESSING_SERVICES="$(PROCESSING_SERVICES)" bash scripts/processing-logs.sh

processing-validate:
	ENV_FILE=$(ENV_FILE) COMPOSE="$(COMPOSE)" bash scripts/processing-validate.sh

source-db-refresh:
	ENV_FILE=$(ENV_FILE) COMPOSE="$(COMPOSE)" bash scripts/source-db-refresh.sh

cdc-clean:
	ENV_FILE=$(ENV_FILE) COMPOSE="$(COMPOSE)" bash scripts/cdc-clean.sh

cdc-up:
	ENV_FILE=$(ENV_FILE) COMPOSE="$(COMPOSE)" bash scripts/cdc-up.sh

cdc-verify:
	ENV_FILE=$(ENV_FILE) COMPOSE="$(COMPOSE)" bash scripts/cdc-verify.sh

cdc-reset-and-verify: source-db-refresh cdc-clean cdc-up cdc-verify

clean-all-from-source: processing-clean-full source-db-refresh cdc-clean cdc-up cdc-verify

foundation-up:
	ENV_FILE=$(ENV_FILE) $(COMPOSE) --env-file $(ENV_FILE) --profile $(FOUNDATION_PROFILE) up -d

foundation-down:
	ENV_FILE=$(ENV_FILE) $(COMPOSE) --env-file $(ENV_FILE) --profile $(FOUNDATION_PROFILE) down

foundation-logs:
	ENV_FILE=$(ENV_FILE) $(COMPOSE) --env-file $(ENV_FILE) --profile $(FOUNDATION_PROFILE) logs -f

redis-projector-reset:
	@echo "==> Stopping redis projector..."
	$(COMPOSE) --profile processing stop imperium-redis-projector
	@echo "==> Deleting Kafka consumer group..."
	@GROUP=$$(grep PHASE3_REDIS_PROJECTOR_GROUP_ID $(ENV_FILE) | cut -d= -f2); \
	docker exec imperium-kafka-1 kafka-consumer-groups \
	  --bootstrap-server kafka:29092 \
	  --group "$$GROUP" --delete 2>/dev/null || true; \
	echo "  Deleted group: $$GROUP"
	@echo "==> Bumping group ID in $(ENV_FILE)..."
	@CURRENT=$$(grep PHASE3_REDIS_PROJECTOR_GROUP_ID $(ENV_FILE) | cut -d= -f2); \
	BASE=$$(echo "$$CURRENT" | sed 's/-v[0-9]*$$//'); \
	VER=$$(echo "$$CURRENT" | grep -oE '[0-9]+$$'); \
	NEW="$$BASE-v$$((VER + 1))"; \
	sed -i "s/PHASE3_REDIS_PROJECTOR_GROUP_ID=.*/PHASE3_REDIS_PROJECTOR_GROUP_ID=$$NEW/" $(ENV_FILE); \
	echo "  $$CURRENT --> $$NEW"
	@echo "==> Flushing Redis..."
	docker exec imperium-redis redis-cli FLUSHALL
	@echo "==> Building redis projector image..."
	$(COMPOSE) --profile processing build imperium-redis-projector
	@echo "==> Starting redis projector with new group..."
	$(COMPOSE) --env-file $(ENV_FILE) --profile processing up -d imperium-redis-projector
	@echo "==> Done. Follow logs with: docker logs -f imperium-redis-projector"

backend-up:
	$(COMPOSE) --env-file $(ENV_FILE) $(BACKEND_PROFILES) up -d $(BACKEND_SERVICES)

backend-down:
	$(COMPOSE) --env-file $(ENV_FILE) $(BACKEND_PROFILES) stop $(BACKEND_SERVICES)

backend-logs:
	$(COMPOSE) --env-file $(ENV_FILE) $(BACKEND_PROFILES) logs -f $(BACKEND_SERVICES)

smoke-test:
	bash scripts/smoke-test.sh

validate-reference-cdc:
	bash scripts/validate-reference-cdc-assets.sh

validate-metadata-cdc:
	bash scripts/validate-metadata-cdc-assets.sh

validate-news-cdc:
	bash scripts/validate-news-cdc-assets.sh
