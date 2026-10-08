.DEFAULT_GOAL := help
COMPOSE      ?= docker compose
COMPOSE_DEV  := $(COMPOSE) -f docker-compose.yml -f docker-compose.dev.yml
PY           ?= .venv/bin/python

.PHONY: help up up-dev up-mobile down build restart ps logs logs-backend logs-web health train \
        api-types setup test test-py test-js lint fmt typecheck clean \
        migrate migration seed seed-demo db-shell db-reset

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

# ---------------------------------------------------------------- docker compose
up: ## Build and start postgres + redis + backend + web (runs migrations first)
	$(COMPOSE) up --build -d
	@$(MAKE) --no-print-directory migrate
	@$(MAKE) --no-print-directory health

up-dev: ## Start with API hot reload and Redis exposed on 6379
	$(COMPOSE_DEV) up --build -d

up-mobile: ## Start everything plus the Expo dev server (needs HOST_IP in .env)
	$(COMPOSE) --profile mobile up --build -d

down: ## Stop all services (keeps volumes)
	$(COMPOSE) --profile mobile down

build: ## Build all images
	$(COMPOSE) --profile mobile build

restart: down up ## Restart the stack

ps: ## Show service status
	$(COMPOSE) ps

logs: ## Tail all logs
	$(COMPOSE) logs -f --tail=100

logs-backend: ## Tail API logs
	$(COMPOSE) logs -f --tail=100 backend

logs-web: ## Tail web logs
	$(COMPOSE) logs -f --tail=100 web

health: ## Check API and web health through the published ports
	@echo -n "backend: "; curl -fsS http://localhost:$${BACKEND_PORT:-8000}/api/v1/health | $(PY) -c 'import sys,json; d=json.load(sys.stdin); print(d["status"], "| model:", d["model"]["source"], d["model"].get("model_version"), "| data:", d["model"].get("data_source"), "| db:", "up" if d["database"]["reachable"] else "DOWN")' || echo "DOWN"
	@echo -n "web:     "; curl -s -o /dev/null -w "%{http_code}\n" http://localhost:$${WEB_PORT:-3000}/login || echo "DOWN"

train: ## Run the ML pipeline inside the backend image, writing to ./data (synthetic unless real raw files exist)
	$(COMPOSE) run --rm backend ai-drews run-all

# ---------------------------------------------------------------- database
migrate: ## Apply database migrations (safe to re-run)
	$(COMPOSE) run --rm backend alembic upgrade head

migration: ## Create a migration from model changes: make migration m="add x"
	@test -n "$(m)" || (echo "usage: make migration m=\"short description\"" && exit 1)
	$(COMPOSE) run --rm backend alembic revision --autogenerate -m "$(m)"

seed: ## Load reference geography (regions, zones, Choke woredas)
	$(COMPOSE) run --rm backend agriminds seed

seed-demo: ## Load geography plus demonstration accounts and plots (never in production)
	$(COMPOSE) run --rm backend agriminds seed --demo

db-shell: ## Open psql against the running database
	$(COMPOSE) exec postgres psql -U $${POSTGRES_USER:-agriminds} -d $${POSTGRES_DB:-agriminds}

db-reset: ## Drop and recreate the schema, then migrate and seed demo data (destroys all rows)
	$(COMPOSE) run --rm backend alembic downgrade base
	@$(MAKE) --no-print-directory migrate
	@$(MAKE) --no-print-directory seed-demo

# ---------------------------------------------------------------- local development (host)
setup: ## Create .venv, install python packages (editable) and JS workspace
	test -d .venv || python3 -m venv .venv
	$(PY) -m pip install -q --upgrade pip uv
	$(PY) -m pip install -q -e "ml[dev]" -e "backend[dev]"
	pnpm install
	test -f .env || cp .env.example .env

api-types: ## Export OpenAPI from the backend and regenerate packages/api-types
	AGRIMINDS_DATA_DIR=./data $(PY) -c "import json; from agriminds_api.main import create_app; from agriminds_api.core.config import Settings; json.dump(create_app(Settings(_env_file=None, data_dir='data')).openapi(), open('packages/api-types/openapi.json','w'), indent=2)"
	pnpm --filter @agriminds/api-types generate

test: test-py test-js ## Run every test suite on the host

test-py: ## Python tests (ml + backend)
	# Run from each package root so its own pytest configuration (asyncio mode, testpaths) applies.
	cd ml && ../$(PY) -m pytest
	cd backend && ../$(PY) -m pytest

test-js: ## JS/TS tests (web + mobile where present)
	pnpm -r --if-present test

lint: ## Lint everything
	$(PY) -m ruff check ml backend
	$(PY) -m ruff format --check ml backend
	pnpm -r --if-present lint

fmt: ## Format everything
	$(PY) -m ruff check --fix ml backend
	$(PY) -m ruff format ml backend
	pnpm -r --if-present format

typecheck: ## Static types (mypy on the API domain layer, tsc on JS packages)
	cd backend && ../$(PY) -m mypy
	pnpm -r --if-present typecheck

clean: ## Stop services and remove volumes, build caches
	$(COMPOSE) --profile mobile down -v --remove-orphans
	find . -path ./.venv -prune -o \( -name __pycache__ -o -name .pytest_cache -o -name .ruff_cache \) -type d -print0 | xargs -0 rm -rf
