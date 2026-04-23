COMPOSE ?= docker-compose
FOUNDATION_PROFILE ?= foundation
ENV_FILE ?= .env

.PHONY: infra-config foundation-up foundation-down foundation-logs smoke-test validate-reference-cdc validate-metadata-cdc validate-news-cdc

infra-config:
	ENV_FILE=$(ENV_FILE) $(COMPOSE) --env-file $(ENV_FILE) config

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
