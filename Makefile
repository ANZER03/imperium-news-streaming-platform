COMPOSE ?= docker-compose
FOUNDATION_PROFILE ?= foundation
ENV_FILE ?= .env

.PHONY: infra-config foundation-up foundation-down foundation-logs

infra-config:
	ENV_FILE=$(ENV_FILE) $(COMPOSE) --env-file $(ENV_FILE) config

foundation-up:
	ENV_FILE=$(ENV_FILE) $(COMPOSE) --env-file $(ENV_FILE) --profile $(FOUNDATION_PROFILE) up -d

foundation-down:
	ENV_FILE=$(ENV_FILE) $(COMPOSE) --env-file $(ENV_FILE) --profile $(FOUNDATION_PROFILE) down

foundation-logs:
	ENV_FILE=$(ENV_FILE) $(COMPOSE) --env-file $(ENV_FILE) --profile $(FOUNDATION_PROFILE) logs -f
