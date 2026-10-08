# AgriMinds · AI-DREWS

> **AI-Enabled Drought Early Warning and Climate-Resilient Decision Support for Smallholder Farming**
> A super-hybrid deep-learning framework over the Choke Mountain Watershed, Amhara, Ethiopia.

AgriMinds turns monthly climate data into a 1–3 month drought-probability map for an 8×8 watershed grid,
a Niño 3.4 (ENSO) outlook, and crop-specific advisories for tef, wheat and maize that can be checked
against indigenous ecological knowledge (IEK). It ships as a web command centre for decision makers and
an offline-capable mobile app for development agents in the field, in English, Amharic and Afaan Oromoo.

> **Status:** the committed model weights were trained on **synthetic** data to validate the pipeline.
> Every API response carries `provenance` and both clients show a banner until real CHIRPS/ERA5/MODIS
> data has been ingested and the models retrained.

---

## Stack

| Layer | Technology | Why |
|---|---|---|
| ML | Python 3.12, PyTorch (CPU), scipy, scikit-learn | the scientific ecosystem for SPI/VCI, CNN-LSTM and spatial models |
| API | FastAPI, Pydantic v2, Redis 7 | typed async API, OpenAPI as the contract for every client |
| Web | Next.js 16 (App Router), React 19, Tailwind CSS v4, shadcn/ui, TanStack Query, next-intl | server-side proxy to the API, tokenised theming, trilingual |
| Mobile | Expo / React Native, expo-router, TanStack Query persisted to AsyncStorage | offline-first field app |
| Infra | Docker Compose, pnpm workspace, uv workspace, GitHub Actions | one command to run, one lockfile per language |

## Repository layout

```
AgriMinds/
├── ml/                      ai-drews Python package: data → features → models → inference → advisory rules → CLI
├── backend/                 agriminds-api FastAPI service (core/, domain/, schemas/, services/, api/v1/)
├── frontend/                Next.js web app (app/, components/, features/, lib/, messages/)
├── mobile/                  Expo field app (app/, src/)
├── packages/api-types/      TypeScript types generated from the API's OpenAPI schema (shared by web + mobile)
├── data/                    raw/, processed/, models/, outputs/  (small, git-tracked; move to DVC before real data)
├── docs/                    research material (proposal PDF, spreadsheets, MATLAB prototype)
├── docker-compose.yml       redis + backend + web (+ `mobile` profile for the Expo dev server)
├── docker-compose.dev.yml   hot-reload overrides for the API
├── Makefile                 developer entry points (`make help`)
├── pyproject.toml, uv.lock  Python workspace (ml + backend)
├── package.json, pnpm-workspace.yaml, pnpm-lock.yaml   JS workspace (frontend + mobile + packages)
└── .github/workflows/ci.yml lint, type-check, test, build and smoke-test the compose stack
```

## Quick start (Docker Compose)

```bash
cp .env.example .env          # set HOST_IP (your LAN IP) if you will use the mobile app
make up                       # builds and starts redis, backend, web; prints health
```

| Service | URL |
|---|---|
| Web command centre | http://localhost:3000 |
| API docs (Swagger) | http://localhost:8000/docs |
| API health | http://localhost:8000/api/v1/health |

More commands:

```bash
make up-dev        # API hot reload (bind-mounts backend/src and ml/src), Redis on :6379
make up-mobile     # also start the Expo dev server; scan the QR code with Expo Go on the same Wi-Fi
make train         # run the ML pipeline inside the backend image (synthetic unless real raw files exist)
make logs          # tail everything
make down          # stop
make help          # everything else
```

## Local development without Docker

```bash
make setup                      # .venv with ml + backend (editable), pnpm install, .env
make test                       # pytest (ml + backend) and JS tests
make lint typecheck             # ruff, mypy (domain layer), eslint, tsc
AGRIMINDS_DATA_DIR=./data .venv/bin/uvicorn agriminds_api.main:app --reload --app-dir backend/src
pnpm --filter @agriminds/web dev
```

## API

All forecast endpoints are under `/api/v1` and protected by `X-API-Key` when `AGRIMINDS_API_KEYS` is set.

| Method | Path | Purpose |
|---|---|---|
| GET | `/health`, `/health/ready` | liveness (always 200) and readiness (503 until a model can be served) |
| GET | `/drought/map?lead_month=1..3` | 8×8 drought probability map with per-cell risk level |
| GET / POST | `/drought/cell` | one cell by `row`/`col` or by `latitude`/`longitude` |
| POST | `/advisories/evaluate` | crop advisory (tef / wheat / maize) with IEK consensus |
| GET | `/enso/outlook` | Niño 3.4 history and CNN-LSTM forecast |

Every forecast response includes `provenance: { model_version, data_source, source, issued_date }`.
Errors are `{ "error": { "code", "message" } }`. Changing a schema → `make api-types` regenerates the shared TypeScript types; CI fails if they drift.

## ML pipeline

See [`ml/README.md`](ml/README.md). In short: `ai-drews build-data`, `build-features`, `train enso`, `train drought`, `maps` or `run-all`.
Real data goes in `data/raw/` (`nino_indices.csv`, `grids.npz`); the pipeline uses it automatically.

## Design principles

- **No fabricated numbers.** Without weights the API returns 503, the web shows an unavailable state, and the mobile app shows its last real response with its age. Nothing invents a probability.
- **One source of truth.** Risk thresholds, ENSO phases, seasons and crop rules live in `ml/src/ai_drews/advisory/rules.py`. Grid geometry lives in `backend/src/agriminds_api/domain/geo.py`. Types flow from the OpenAPI schema to both clients.
- **Honest provenance.** Model version and data source travel with every response and are displayed.
- **Boring, reproducible builds.** Locked dependencies (uv, pnpm), multi-stage non-root images, CI that builds the whole compose stack.

## Research attribution

Developed under the **AI-DREWS** initiative with **Debre Markos University**, the **AI Institute of Ethiopia**
and agricultural domain specialists for the Choke Mountain Watershed. Research material is in [`docs/research`](docs/research).
