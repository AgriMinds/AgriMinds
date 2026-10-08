# agriminds-api

FastAPI service exposing the AI-DREWS forecasts. Depends on the `ai-drews` package in `../ml`.

```
src/agriminds_api/
├── main.py            create_app() + lifespan (loads the model and opens the database pool once)
├── cli.py             `agriminds` admin commands: seed, create-user, list-users
├── core/              config, logging + request ids, typed exceptions, cache, security (argon2 + JWT)
├── db/                declarative base, async session factory, ORM models, seed data
├── domain/            pure logic: grid <-> lat/lon (geo.py), risk vocabulary (risk.py)
├── schemas/           Pydantic request/response models (OpenAPI source of truth for web + mobile types)
├── services/          inference (cached risk cube), drought, advisory, enso, auth, farm, dashboard
└── api/v1/            routers: /health, /auth, /drought, /advisories, /enso, /farms, /dashboard
alembic/               migrations (one revision per schema change)
```

## Run locally

```bash
pip install -e ml -e "backend[dev]"
docker compose up -d postgres redis

export AGRIMINDS_DATA_DIR=./data
export AGRIMINDS_DATABASE_URL="postgresql+asyncpg://agriminds:<password>@localhost:5432/agriminds"
export AGRIMINDS_JWT_SECRET="$(openssl rand -hex 32)"

cd backend && alembic upgrade head && cd ..
agriminds seed --demo
uvicorn agriminds_api.main:app --reload --app-dir backend/src
open http://localhost:8000/docs
```

## Configuration (`AGRIMINDS_*` environment variables, see `.env.example`)

| variable | default | purpose |
|---|---|---|
| `AGRIMINDS_DATA_DIR` | `data` | root with `processed/`, `models/`, `outputs/` |
| `AGRIMINDS_REDIS_URL` | unset | enables Redis cache for the risk cube; falls back to memory if unreachable |
| `AGRIMINDS_CORS_ORIGINS` | `http://localhost:3000` | explicit origins; `*` is rejected |
| `AGRIMINDS_API_KEYS` | empty | comma-separated keys for `X-API-Key`; empty disables auth (dev only) |
| `AGRIMINDS_ALLOW_PRECOMPUTED_FALLBACK` | `true` | serve `outputs/latest_risk.npz` when weights are missing (status `degraded`) |
| `AGRIMINDS_DATABASE_URL` | local postgres | async SQLAlchemy URL (`postgresql+asyncpg://…`) |
| `AGRIMINDS_JWT_SECRET` | dev placeholder | signing key; the app refuses to start in production with the placeholder |
| `AGRIMINDS_ACCESS_TOKEN_TTL_MINUTES` | `15` | access-token lifetime |
| `AGRIMINDS_REFRESH_TOKEN_TTL_DAYS` | `14` | refresh-token lifetime |
| `AGRIMINDS_LOGIN_MAX_ATTEMPTS` / `_LOCKOUT_MINUTES` | `8` / `15` | brute-force lockout |

## Behaviour guarantees

- No fabricated numbers: without weights or a precomputed raster, forecast endpoints return `503 model_unavailable`
  and `/health` reports `unavailable`; `/health/ready` returns 503 for orchestrators.
- Every forecast response carries `provenance` (`model_version`, `data_source`, `source`, `issued_date`).
- Errors are `{ "error": { "code", "message" } }`; internals are logged, never returned.
- Handlers are synchronous `def` so PyTorch runs in the threadpool, and the risk cube is cached per issue month.
- A wrong password and an unknown account are indistinguishable, and failed attempts survive the 401 they
  cause, so the lockout counter actually counts.
- Refresh tokens rotate; replaying one revokes the whole session family.
- Row visibility is enforced server-side: a farmer's query is scoped to their own plots, an agent's to
  their own woreda. Someone else's record answers 404, never 403.

## Tests

```bash
docker compose up -d postgres
cd backend && pytest          # run from the package root so its pytest config applies
```

The suite trains a two-epoch model on synthetic data once per session and creates a `…_test` database
beside the configured one. Tests run against **PostgreSQL**, not SQLite, because the schema uses native
enum types and row-value comparisons; each test ends by truncating every table. If no database is
reachable the database tests skip rather than fail.
