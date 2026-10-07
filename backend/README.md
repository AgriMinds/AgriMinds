# agriminds-api

FastAPI service exposing the AI-DREWS forecasts. Depends on the `ai-drews` package in `../ml`.

```
src/agriminds_api/
├── main.py            create_app() + lifespan (loads the model once, builds services)
├── core/              config (pydantic-settings), logging + request ids, typed exceptions, cache, API keys
├── domain/            pure logic: grid <-> lat/lon (geo.py), risk vocabulary (risk.py)
├── schemas/           Pydantic request/response models (OpenAPI source of truth for web + mobile types)
├── services/          inference (cached risk cube), drought, advisory, enso
└── api/v1/            routers: /health, /drought, /advisories, /enso
```

## Run locally

```bash
pip install -e ml -e "backend[dev]"
AGRIMINDS_DATA_DIR=./data uvicorn agriminds_api.main:app --reload --app-dir backend/src
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

## Behaviour guarantees

- No fabricated numbers: without weights or a precomputed raster, forecast endpoints return `503 model_unavailable`
  and `/health` reports `unavailable`; `/health/ready` returns 503 for orchestrators.
- Every forecast response carries `provenance` (`model_version`, `data_source`, `source`, `issued_date`).
- Errors are `{ "error": { "code", "message" } }`; internals are logged, never returned.
- Handlers are synchronous `def` so PyTorch runs in the threadpool, and the risk cube is cached per issue month.

## Tests

```bash
pytest backend/tests          # trains a 2-epoch model on synthetic data in a temp dir, then hits the API
```
