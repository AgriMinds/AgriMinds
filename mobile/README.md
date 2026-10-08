# AgriMinds AI-DREWS Mobile (Expo SDK 57, expo-router)

Field app for Development Agents and farmers in the Choke Mountain Watershed. Reads the same
FastAPI backend as the web console through the shared `@agriminds/api-types` package.

## Structure

```
app/                     expo-router routes
├── _layout.tsx          providers: persisted TanStack Query, SafeArea, i18n, StatusBar
└── (tabs)/              index (advisory) · grid · enso · settings
src/
├── components/          Card, SegmentedControl, RiskBadge, GridMap, ThumbPad, Banners, States, Screen
├── features/            useAdvisory, useDroughtMap, useEnsoOutlook, useHealth, useLocation (+ queryKeys)
├── services/            api.ts (typed client, ApiError), config.ts (base URL / key), queryClient.ts
├── state/               zustand store: crop, lead, IEK, selected cell or GPS position
├── storage/             AsyncStorage helpers (preferences, cache key)
├── i18n/                en / am / or catalogues with identical keys; device locale default
├── theme/               light/dark palettes, risk colours, spacing, typography
└── utils/               relativeTime, error -> message key
assets/                  icon, adaptive-icon, splash-icon, favicon (regenerate: node scripts/make-icons.js)
```

## Run on a device (Expo Go)

```bash
pnpm install                                    # from the repo root
cd mobile
EXPO_PUBLIC_API_URL=http://<HOST_IP>:8000/api/v1 pnpm start   # HOST_IP = your machine's LAN IP
```

Scan the QR code with Expo Go. The API address and key can also be changed at runtime under
**Settings** (persisted on the device). Emulator defaults: Android `10.0.2.2:8000`, iOS `localhost:8000`.

With Docker Compose (Metro inside a container, phone on the same Wi-Fi):

```bash
HOST_IP=192.168.0.104 docker compose --profile mobile up
```

## Offline behaviour

- Every successful response is persisted (TanStack Query + AsyncStorage, 7 days).
- When a request fails and cached data exists, the last REAL response is shown with an
  **Offline · last updated …** banner and a retry button.
- When nothing is cached, an explicit empty state is shown. The app never invents numbers.
- Forecasts whose `provenance.data_source` is not `real`, or whose `source` is `precomputed`,
  show a warning banner so demonstration data is never mistaken for a live forecast.

## GPS

**Use my location** (foreground permission only) sends latitude/longitude; the server resolves
the grid cell and the app shows it. Positions outside the watershed produce a translated
"outside the grid" message (HTTP 422 `invalid_location`).

## Checks

```bash
pnpm typecheck && pnpm lint && pnpm test
npx expo-doctor
pnpm exec expo export --platform android --output-dir /tmp/expo-export   # JS bundle check
```
