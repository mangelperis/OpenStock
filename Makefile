# OpenStock — common local commands
# Usage: make help

COMPOSE ?= docker compose
APP     ?= openstock
URL     ?= http://localhost:3001

.DEFAULT_GOAL := help

.PHONY: help up up-build down restart rebuild logs logs-app ps shell \
	mongo mongo-up status clean-volumes install dev build start test test-watch test-db lint check-env

help: ## Show this help
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z0-9_-]+:.*?## / {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# --- Docker lifecycle ---

up: ## Start stack (detached; build if image missing)
	$(COMPOSE) up -d

up-build: ## Build images and start stack
	$(COMPOSE) up -d --build

down: ## Stop and remove containers (keeps Mongo volume)
	$(COMPOSE) down

restart: ## Restart all services
	$(COMPOSE) restart

rebuild: ## Rebuild and recreate the app container only
	$(COMPOSE) up -d --build --force-recreate $(APP)

logs: ## Tail logs for all services
	$(COMPOSE) logs -f --tail=100

logs-app: ## Tail app logs only
	$(COMPOSE) logs -f --tail=100 $(APP)

ps: ## Show compose service status
	$(COMPOSE) ps

status: ps ## Alias for ps
	@echo "App: $(URL)"

shell: ## Open a shell in the app container
	$(COMPOSE) exec $(APP) sh

mongo-up: ## Start MongoDB only
	$(COMPOSE) up -d mongodb

mongo: ## Open mongosh in the MongoDB container
	$(COMPOSE) exec mongodb mongosh -u root -p example --authenticationDatabase admin

clean-volumes: ## Stop stack and DELETE Mongo data volume (destructive)
	$(COMPOSE) down -v

# --- Local Node (host) ---

install: ## Install npm dependencies
	npm install

dev: ## Run Next.js dev server on the host
	npm run dev

build: ## Production build on the host
	npm run build

start: ## Start production server on the host
	npm run start

test: ## Run Vitest once
	npm test

test-watch: ## Run Vitest in watch mode
	npm run test:watch

test-db: ## Smoke-test MongoDB connectivity
	npm run test:db

lint: ## Run ESLint
	npm run lint

check-env: ## Validate required env vars (scripts/check-env.mjs)
	node scripts/check-env.mjs
