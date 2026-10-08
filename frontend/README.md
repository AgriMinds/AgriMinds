# @agriminds/web

Next.js 16 (App Router, React 19, Tailwind v4) dashboard for AgriMinds AI-DREWS.

```
app/
├── layout.tsx              server: fonts (Inter + Noto Sans Ethiopic), locale, providers, skip link
├── page.tsx                thin: heading + <Dashboard/>
├── providers.tsx           TanStack Query provider
├── actions/locale.ts       server action: sets the NEXT_LOCALE cookie
├── api/v1/[...path]/route.ts  same-origin proxy -> FastAPI (injects X-API-Key server-side)
└── globals.css             ALL colour/font tokens (@theme); light/dark; no hex in components
components/
├── ui/                     button, card, badge, skeleton, chart, query-state
└── layout/                 Shell, Sidebar, TopBar (health chip), ThemeToggle, LanguageSwitcher
features/
├── dashboard/Dashboard.tsx UI state (lead, cell, crop, IEK) + query wiring
├── drought/                WatershedGridMap + useDroughtMap
├── advisory/               CropDecisionPanel + useAdvisory
├── enso/                   EnsoMonitor (recharts) + useEnsoOutlook
├── summary/                WatershedSummary, ProvenanceBanner, ReportsPlaceholder
└── health/useHealth.ts     polls /health every 30 s
i18n/  messages/{en,am,or}.json   next-intl without locale routing (cookie based)
lib/   api/client.ts (typed, ApiError), risk.ts (token classes), query-client.ts, utils.ts
```

Types come from `@agriminds/api-types` (generated from the backend OpenAPI schema; `make api-types`).

## Environment (server-side only; nothing is exposed with `NEXT_PUBLIC_`)

| variable | default | purpose |
|---|---|---|
| `API_INTERNAL_URL` | `http://localhost:8000` | where the proxy forwards `/api/v1/*` (in compose: `http://backend:8000`) |
| `API_KEY` | unset | sent as `X-API-Key` to the backend when `AGRIMINDS_API_KEYS` is configured |

## Commands (run from the repo root)

```bash
pnpm install
pnpm --filter @agriminds/web dev        # http://localhost:3000 (expects the API on :8000)
pnpm --filter @agriminds/web lint
pnpm --filter @agriminds/web typecheck
pnpm --filter @agriminds/web test       # vitest + jsdom
pnpm --filter @agriminds/web build      # standalone output
```

Docker: built from the repo root with `frontend/Dockerfile` (see `docker-compose.yml`).

## Honesty rules baked into the UI

- Every forecast response carries `provenance`; a banner is shown whenever data is synthetic or precomputed.
- The health chip reflects `/health` (`healthy` / `degraded` / `unavailable`) or `offline`.
- No placeholder figures: the reports section is an explicit empty state until a reporting service exists.
