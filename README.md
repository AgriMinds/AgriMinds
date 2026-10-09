# AgriMinds · AI-DREWS

> **AI-Enabled Drought Early Warning and Climate-Resilient Decision Support for Smallholder Farming**
> A super-hybrid deep-learning framework over the Choke Mountain Watershed, Amhara, Ethiopia.

AgriMinds turns monthly climate data into a 1–3 month drought-probability map for an 8×8 watershed grid,
a Niño 3.4 (ENSO) outlook, and crop-specific advisories for tef, wheat and maize that can be checked
against indigenous ecological knowledge (IEK). It ships as a web command centre for decision makers and
an offline-capable mobile app for development agents in the field, in English, Amharic and Afaan Oromoo.

Signing in puts each person in front of the view that matches their job:

| Role | Lands on | Sees |
|---|---|---|
| **Farmer** | `/farm` | Their own plots, each plot's drought risk, the advisory for the plot that needs attention first, and a button to confirm they have read it |
| **Development agent** | `/ministry` | The same ministry view, scoped to the single woreda they are posted to |
| **Minister / administrator** | `/ministry` | Coverage, risk exposure, a woreda breakdown, crop mix and advisory delivery across the whole watershed |

Every ministry figure is counted from registered rows — farmers, plots, hectares and advisory records
that exist in the database. Risk is attached from the live model. Nothing on either dashboard is estimated.

> **Status:** the committed model weights were trained on **synthetic** data to validate the pipeline.
> `make ingest` downloads the study's real inputs — every source is public and needs no credentials —
> and `make train` retrains on them. Until that has run, every API response carries `provenance`
> and both clients show a banner, so a demonstration is never mistaken for a forecast.

---

## Stack

| Layer | Technology | Why |
|---|---|---|
| ML | Python 3.12, PyTorch (CPU), scipy, scikit-learn | the scientific ecosystem for SPI/VCI, CNN-LSTM and spatial models |
| API | FastAPI, Pydantic v2, SQLAlchemy 2 (async), Alembic, Redis 7 | typed async API, OpenAPI as the contract for every client |
| Database | PostgreSQL 17 | accounts, administrative geography, farm plots and the advisory delivery log |
| Auth | Argon2id passwords, JWT access tokens, rotating refresh tokens | short-lived bearer tokens held in httpOnly cookies by the web app |
| Web | Next.js 16 (App Router), React 19, Tailwind CSS v4, shadcn/ui, TanStack Query, next-intl | server-side proxy to the API, tokenised theming, trilingual |
| Mobile | Expo / React Native, expo-router, TanStack Query persisted to AsyncStorage | offline-first field app |
| Infra | Docker Compose, pnpm workspace, uv workspace, GitHub Actions | one command to run, one lockfile per language |

## Repository layout

```
AgriMinds/
├── ml/                      ai-drews Python package: data → features → models → inference → advisory rules → CLI
├── backend/                 agriminds-api FastAPI service (core/, db/, domain/, schemas/, services/, api/v1/)
│   └── alembic/             database migrations
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
cp .env.example .env
# Fill in the two required secrets:
#   POSTGRES_PASSWORD=$(openssl rand -base64 24)
#   AGRIMINDS_JWT_SECRET=$(openssl rand -hex 32)
# Set HOST_IP to your LAN IP if you will use the mobile app.

make up                       # starts postgres, redis, backend and web, then migrates
make seed-demo                # reference geography + demonstration accounts and plots
```

Sign in at http://localhost:3000/login with one of the seeded accounts:

| Identifier | Password | Lands on |
|---|---|---|
| `minister@moa.gov.et` | `AgriMinds#2026` | ministry dashboard, whole watershed |
| `agent.sinan@moa.gov.et` | `AgriMinds#2026` | ministry dashboard, Sinan woreda only |
| `0912000001` | `AgriMinds#2026` | farmer dashboard, three plots |

`make seed-demo` refuses to run when `AGRIMINDS_ENV=production`, because these passwords are published here.
Create the first real administrator with `docker compose run --rm backend agriminds create-user you@example.et --role admin`.

| Service | URL |
|---|---|
| Web command centre | http://localhost:3000 |
| API docs (Swagger) | http://localhost:8000/docs |
| API health | http://localhost:8000/api/v1/health |

More commands:

```bash
make up-dev        # API hot reload (bind-mounts backend/src and ml/src), Redis and Postgres on host ports
make up-mobile     # also start the Expo dev server; scan the QR code with Expo Go on the same Wi-Fi
make migrate       # apply database migrations (safe to re-run)
make migration m="add x"   # autogenerate a migration from model changes
make seed          # reference geography only (what a real deployment needs)
make db-shell      # psql against the running database
make db-reset      # drop, migrate and reseed demo data (destroys all rows)
make ingest        # download the real inputs (NOAA, ERA5, CHIRPS, ERA5-wind, FAOSTAT) into data/
make ingest-one s=ndvi  # opt-in MODIS greenness (hours; not part of `make ingest`)
make data-sources  # what this deployment is actually running on
make train         # run the ML pipeline inside the backend image
make train-real    # ingest, then train on the observed record
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

Everything lives under `/api/v1`. Sign in, then send `Authorization: Bearer <access_token>`.

| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | `/health`, `/health/ready` | public | liveness (always 200) and readiness (503 until model **and** database are ready) |
| POST | `/auth/login` | public | sign in with an email address or Ethiopian mobile number |
| POST | `/auth/refresh`, `/auth/logout` | public | rotate or end a session |
| GET / PATCH | `/auth/me` | signed in | profile; `POST /auth/me/password` changes the password |
| GET | `/drought/map`, `/drought/cell` | signed in or service key | 8×8 drought probability, or one cell by row/col or GPS |
| POST | `/advisories/evaluate` | signed in or service key | crop advisory with IEK consensus |
| GET | `/enso/outlook` | signed in or service key | Niño 3.4 history and CNN-LSTM forecast |
| GET / POST / PATCH / DELETE | `/farms`, `/farms/{id}` | farmer | the farmer's own plots |
| GET | `/farms/{id}/advisory` | farmer | advisory for one plot, logged for delivery reporting |
| GET | `/dashboard/farmer` | farmer | plots, risk, the advisory that needs attention first |
| GET | `/dashboard/ministry` | agent / minister / admin | coverage, exposure, woreda breakdown, crop mix, delivery |
| POST | `/dashboard/farmer/advisories/{id}/acknowledge` | farmer | confirm an advisory was read |

Every forecast response includes `provenance: { model_version, data_source, source, issued_date }`.
Errors are `{ "error": { "code", "message" } }`. Changing a schema → `make api-types` regenerates the shared TypeScript types; CI fails if they drift.

### Authentication

- Passwords are hashed with **argon2id** (19 MiB, 2 passes). A wrong password and an unknown account return
  the identical response, so the API cannot be used to discover who is registered.
- Eight failed attempts lock an account for fifteen minutes.
- Access tokens are JWTs valid for 15 minutes. Refresh tokens last 14 days, are stored only as SHA-256
  hashes, and **rotate on every use**. Presenting an already-rotated token is treated as theft and revokes
  every session descended from that sign-in.
- The browser never holds a token in JavaScript: the Next.js server keeps them in httpOnly cookies and
  attaches the bearer header when it proxies to the API.
- `AGRIMINDS_API_KEYS` remains for machine clients (the mobile app, the web proxy's unauthenticated calls).

## Where the data comes from

`GET /api/v1/system/data-sources` — and the `/data-sources` page — report what the running
deployment is actually built from, derived from the ingest manifests and model metadata present
rather than from a fixed list.

`make ingest` connects all six. Every route below is public and needs **no credentials**, so a
fresh clone can reach real observations without an account anywhere:

| Input | Provider | Route |
|---|---|---|
| Niño 3.4, Niño 1+2, Niño 4, SOI | NOAA PSL (ERSST v6) | fixed-width index tables |
| Temperature, rainfall, soil moisture, evaporation | ERA5 (ECMWF) | Open-Meteo archive |
| Rainfall for validation | CHIRPS v2.0 | SERVIR ClimateSERV zonal means |
| Crop area, yield, production for tef, wheat, maize | FAOSTAT (Ethiopia's official statistics) | bulk CSV |
| Sc-PDSI drought index | computed here | Palmer water balance |
| 10 m wind (u/v components) | ERA5 (ECMWF) | Open-Meteo archive — hourly, resumable |

Two honest caveats travel with the data rather than being smoothed over. FAO publishes no `teff`
item: Ethiopian teff sits inside `Cereals n.e.c.`, which for Ethiopia is overwhelmingly teff, and
the inventory says so. And CHIRPS is used for the job the study gives it — checking ERA5, not
driving the forecast — so that entry only reports connected once the comparison has actually run,
with the correlation and bias it found.

**Provenance comes from the ingest manifest, never from a file existing.** The synthetic generator
writes to the same paths as the connectors, so without that manifest a second pipeline run would
load its own stand-in data and stamp the model "real".

Sc-PDSI is computed from the full Palmer water balance — evapotranspiration, recharge, runoff and
loss, each against its potential — so its dry bands drive drought warning and its wet bands flood
warning. The catchment outline is the surveyed one: 18,948 km², from
`cmw_max_boundary_wgs` (see [`docs/research`](docs/research/README.md)). Because the forecast grid
is a rectangle over a catchment that is not one, 15 of its 64 cells fall outside the basin and are
marked rather than reported as readings.

## How far ahead the forecast is trustworthy

The model is trained for twelve months, but training a lead is not the same as earning the right
to publish it. Each lead is scored against climatology on held-out data at training time, and
only the ones that beat it are served as a probability:

| lead | 1 | 2 | 3 | 6 | 12 |
|---|---|---|---|---|---|
| AUC | 0.714 | 0.595 | 0.492 | 0.487 | 0.428 |
| BSS vs climatology | **+0.058** | +0.011 | −0.021 | −0.028 | −0.038 |

On the current observed record that is **lead 1 only**. The other eleven months are served as a
*seasonal outlook*: a direction and the reasoning behind it, never a percentage. `/prediction`
shows all twelve with the measured skill beside each, so the horizon is visible rather than
implied, and it widens by itself as the record and the inputs improve.

`GET /api/v1/drought/horizon` returns the same thing for any client.

## Analytics

Alongside the operational dashboards there is a read-only `analytics` schema: a star schema of
views built for business-intelligence tools, plus an `agriminds_bi` role that can read those views
and nothing else — no accounts, no password hashes, no phone numbers.

```bash
make bi-role password="$(openssl rand -base64 24)"   # enable the read-only login
make snapshot                                        # persist the current forecast for reporting
make analytics                                       # start Metabase on :3001 (optional)
```

Point any SQL client at that schema — Metabase, DBeaver, psql, R, pandas — or embed a Metabase
dashboard in the app by setting `AGRIMINDS_METABASE_*`. Without those variables the API returns
`503 metabase_not_configured` and the web app explains what is missing rather than rendering a
broken frame.

**Power BI was the original plan and was dropped.** App-owns-data embedding needs a paid Fabric or
Power BI Embedded capacity — a recurring licence cost for a public agency. Metabase is open
source, self-hosted and does the same job: a dashboard inside the app, scoped per viewer, with no
figure leaving the deployment.

Forecasts live in the model, not the database, so `make snapshot` writes each run to
`risk_snapshots`; `make train` does it automatically. See [`docs/analytics.md`](docs/analytics.md)
for the data model, the joins, and how to scope a development agent to their own woreda with a
locked parameter.

The farmer dashboard stays native on purpose: farmers use a phone, in Amharic or Afaan Oromoo, often
on a weak connection, and should never need a BI tool to be told whether to plant.

## Database

PostgreSQL holds accounts, the Ethiopian administrative hierarchy (region → zone → woreda), farm plots,
and one row per advisory actually shown to a farmer.

```
regions ─< zones ─< woredas ─< users ─< farms ─< advisory_records
                                  └─< refresh_tokens
risk_snapshots          one row per grid cell, lead and model run
analytics.*             read-only star-schema views for BI tools
```

Migrations are Alembic revisions in `backend/alembic/versions/`, applied with `make migrate` as a
deliberate step rather than on container boot. CI runs `alembic check` so a model change without a
migration fails the build, and applies `downgrade base` to prove each migration is reversible.

## ML pipeline

See [`ml/README.md`](ml/README.md). In short: `ai-drews build-data`, `build-features`, `train enso`, `train drought`, `maps` or `run-all`.
Real data goes in `data/raw/` (`nino_indices.csv`, `grids.npz`); the pipeline uses it automatically.

## Design principles

- **No fabricated numbers.** Without weights the API returns 503, the web shows an unavailable state, and the mobile app shows its last real response with its age. Nothing invents a probability. The ministry dashboard counts registered rows; when there is no model it reports coverage and omits risk entirely rather than guessing.
- **Least privilege by default.** A farmer can only read their own plots, and another farmer's plot or advisory answers 404 rather than 403 so identifiers cannot be probed. An agent is scoped to their woreda by the server, not by a query parameter the client could change.
- **One source of truth.** Risk thresholds, ENSO phases, seasons and crop rules live in `ml/src/ai_drews/advisory/rules.py`. Grid geometry lives in `backend/src/agriminds_api/domain/geo.py`. Types flow from the OpenAPI schema to both clients.
- **Honest provenance.** Model version and data source travel with every response and are displayed.
- **Boring, reproducible builds.** Locked dependencies (uv, pnpm), multi-stage non-root images, CI that builds the whole compose stack.

## Research attribution

Developed under the **AI-DREWS** initiative with **Debre Markos University**, the **AI Institute of Ethiopia**
and agricultural domain specialists for the Choke Mountain Watershed. Research material is in [`docs/research`](docs/research).
