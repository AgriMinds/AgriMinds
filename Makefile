.DEFAULT_GOAL := help
COMPOSE      ?= docker compose
COMPOSE_DEV  := $(COMPOSE) -f docker-compose.yml -f docker-compose.dev.yml
PY           ?= .venv/bin/python

.PHONY: help up up-dev up-mobile down build restart ps logs logs-backend logs-web health train \
        api-types setup test test-py test-js lint fmt typecheck clean \
        migrate migration seed seed-demo db-shell db-reset snapshot bi-role

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

ingest: ## Download the study's observational inputs (NOAA, ERA5, CHIRPS, MODIS, FAOSTAT) into data/
	$(COMPOSE) run --rm backend ai-drews ingest all

ingest-one: ## Download one source: make ingest-one s=era5 (nino34|era5|ndvi|chirps|crops|validation|assemble)
	@test -n "$(s)" || { echo "usage: make ingest-one s=<source>"; exit 2; }
	$(COMPOSE) run --rm backend ai-drews ingest $(s)

data-sources: ## Show what is currently supplying this deployment
	$(COMPOSE) run --rm backend ai-drews data-sources

train: ## Run the ML pipeline inside the backend image, then persist the forecast for reporting
	$(COMPOSE) run --rm backend ai-drews run-all
	@$(MAKE) --no-print-directory snapshot

train-real: ingest train ## Download the observed record, then train on it

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

snapshot: ## Persist the current forecast to risk_snapshots so BI tools can read it
	$(COMPOSE) run --rm backend agriminds snapshot-risk

bi-role: ## Enable the read-only analytics login for BI tools (prints the password once)
	@test -n "$(password)" || (echo 'usage: make bi-role password="$$(openssl rand -base64 24)"' && exit 1)
	$(COMPOSE) exec -T postgres psql -U $${POSTGRES_USER:-agriminds} -d $${POSTGRES_DB:-agriminds} -c \
	  "ALTER ROLE agriminds_bi WITH LOGIN PASSWORD '$(password)';"
	@echo "agriminds_bi can now sign in. It can read schema 'analytics' and nothing else."

grid-geojson: ## Write the forecast grid as polygons, for choropleth maps
	$(COMPOSE) run --rm backend ai-drews grid-geojson

analytics: ## Start Metabase (open source, no licence) on http://localhost:3001
	$(COMPOSE) --profile analytics up -d metabase
	@echo "Metabase starting on http://localhost:$${METABASE_PORT:-3001} (first boot takes a minute)."
	@echo "Connect it to postgres/agriminds as 'agriminds_bi' -- see docs/analytics.md."

analytics-setup: ## Provision Metabase: admin, read-only database, embedding and the dashboard
	@test -n "$(admin_password)" || (echo 'usage: make analytics-setup admin_password="<metabase admin>" [password="<agriminds_bi>"]' && echo '       password= is only needed the first time, to create the database connection.' && exit 1)
	METABASE_PG_PASSWORD='$(password)' METABASE_ADMIN_PASSWORD='$(admin_password)' \
	  METABASE_URL=http://localhost:$${METABASE_PORT:-3001} $(PY) scripts/metabase_setup.py

analytics-down: ## Stop Metabase, leaving the rest of the stack running
	$(COMPOSE) --profile analytics stop metabase

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
