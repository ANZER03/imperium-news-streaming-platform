COMPOSE ?= docker-compose
FOUNDATION_PROFILE ?= foundation
PROCESSING_PROFILE ?= processing
ENV_FILE ?= .env
PROCESSING_SERVICES := imperium-dimension-driver imperium-canonical-enrichment-driver imperium-classification-driver imperium-redis-driver imperium-redis-topics-driver imperium-qdrant-driver

.PHONY: infra-config foundation-up foundation-down foundation-logs smoke-test validate-reference-cdc validate-metadata-cdc validate-news-cdc source-db-refresh cdc-clean cdc-up cdc-verify cdc-reset-and-verify processing-config processing-down processing-clean processing-clean-full processing-up processing-reset-and-run processing-logs processing-validate clean-all-from-source

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

smoke-test:
	bash scripts/smoke-test.sh

validate-reference-cdc:
	bash scripts/validate-reference-cdc-assets.sh

validate-metadata-cdc:
	bash scripts/validate-metadata-cdc-assets.sh

validate-news-cdc:
	bash scripts/validate-news-cdc-assets.sh
