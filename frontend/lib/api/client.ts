import type {
  AdvisoryRequest,
  AnalyticsConnection,
  AdvisoryResponse,
  CellRiskResponse,
  DataInventory,
  DroughtMapResponse,
  EmbedConfig,
  EnsoOutlookResponse,
  ErrorResponse,
  Farm,
  FarmAdvisory,
  FarmCreate,
  FarmUpdate,
  FarmerDashboard,
  HealthResponse,
  LeadMonth,
  MinistryDashboard,
  PowerBiStatus,
  User,
  WatershedBoundary,
} from '@agriminds/api-types'
import { API_V1_PREFIX } from '@agriminds/api-types'

/**
 * Browser-side client. It only ever talks to the same-origin proxy at /api/v1/*,
 * which forwards to the FastAPI service and injects the API key server-side.
 */
export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }

  get isUnavailable(): boolean {
    return this.status === 503 || this.code === 'model_unavailable'
  }

  /** The session is gone: the shell should send the person back to sign in. */
  get isUnauthenticated(): boolean {
    return this.status === 401
  }

  get isForbidden(): boolean {
    return this.status === 403
  }
}

async function parseError(res: Response): Promise<ApiError> {
  let code = 'http_error'
  let message = res.statusText || `HTTP ${res.status}`
  try {
    const body = (await res.json()) as Partial<ErrorResponse> & { detail?: unknown }
    if (body.error?.code) {
      code = body.error.code
      message = body.error.message
    } else if (typeof body.detail === 'string') {
      message = body.detail
    } else if (Array.isArray(body.detail)) {
      code = 'validation_error'
      message = 'Request validation failed'
    }
  } catch {
    /* non-JSON body: keep status text */
  }
  return new ApiError(res.status, code, message)
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_V1_PREFIX}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
    cache: 'no-store',
  })
  if (!res.ok) {
    const error = await parseError(res)
    // The proxy already cleared the cookies. A full document load is deliberate: a soft
    // router navigation would keep the client router cache, which still holds the RSC
    // payload rendered for the session that just ended.
    if (error.isUnauthenticated && typeof window !== 'undefined') {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`)
    }
    throw error
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

const lead = (leadMonth: LeadMonth) => `?lead_month=${leadMonth}`

export const api = {
  health: () => request<HealthResponse>('/health'),
  droughtMap: (leadMonth: LeadMonth) => request<DroughtMapResponse>(`/drought/map?lead_month=${leadMonth}`),
  cellRisk: (params: { leadMonth: LeadMonth; row: number; col: number }) =>
    request<CellRiskResponse>(
      `/drought/cell?lead_month=${params.leadMonth}&row=${params.row}&col=${params.col}`,
    ),
  evaluateAdvisory: (payload: AdvisoryRequest) =>
    request<AdvisoryResponse>('/advisories/evaluate', { method: 'POST', body: JSON.stringify(payload) }),
  ensoOutlook: () => request<EnsoOutlookResponse>('/enso/outlook'),
  /** Surveyed catchment outline and which grid cells fall inside it. 404 when none is configured. */
  watershed: () => request<WatershedBoundary>('/drought/watershed'),

  // ---- account ------------------------------------------------------------------------
  me: () => request<User>('/auth/me'),
  updateProfile: (payload: { full_name?: string; locale?: string }) =>
    request<User>('/auth/me', { method: 'PATCH', body: JSON.stringify(payload) }),

  // ---- farmer -------------------------------------------------------------------------
  farmerDashboard: (leadMonth: LeadMonth) => request<FarmerDashboard>(`/dashboard/farmer${lead(leadMonth)}`),
  farms: (leadMonth: LeadMonth) => request<Farm[]>(`/farms${lead(leadMonth)}`),
  createFarm: (payload: FarmCreate, leadMonth: LeadMonth) =>
    request<Farm>(`/farms${lead(leadMonth)}`, { method: 'POST', body: JSON.stringify(payload) }),
  updateFarm: (id: string, payload: FarmUpdate, leadMonth: LeadMonth) =>
    request<Farm>(`/farms/${id}${lead(leadMonth)}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteFarm: (id: string) => request<void>(`/farms/${id}`, { method: 'DELETE' }),
  farmAdvisory: (id: string, leadMonth: LeadMonth) =>
    request<FarmAdvisory>(`/farms/${id}/advisory${lead(leadMonth)}`),
  acknowledgeAdvisory: (advisoryId: string) =>
    request<void>(`/dashboard/farmer/advisories/${advisoryId}/acknowledge`, { method: 'POST' }),

  // ---- ministry -----------------------------------------------------------------------
  ministryDashboard: (leadMonth: LeadMonth) =>
    request<MinistryDashboard>(`/dashboard/ministry${lead(leadMonth)}`),

  // ---- analytics ----------------------------------------------------------------------
  powerbiStatus: () => request<PowerBiStatus>('/analytics/powerbi/status'),
  /** A fresh embed token. Minted server-side per viewer; the browser never calls Microsoft. */
  powerbiEmbedToken: () => request<EmbedConfig>('/analytics/powerbi/embed-token'),
  analyticsConnection: () => request<AnalyticsConnection>('/analytics/connection'),

  // ---- provenance ---------------------------------------------------------------------
  dataSources: () => request<DataInventory>('/system/data-sources'),
}

/** Direct download, so the browser saves the file rather than the client parsing it. */
export const PBIDS_PATH = `${API_V1_PREFIX}/analytics/connection.pbids`

/** Sign-in and sign-out go through dedicated route handlers so tokens stay server-side. */
export const authApi = {
  async login(identifier: string, password: string): Promise<User> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ identifier, password }),
      cache: 'no-store',
    })
    if (!res.ok) throw await parseError(res)
    return ((await res.json()) as { user: User }).user
  },
  async logout(): Promise<void> {
    await fetch('/api/auth/logout', { method: 'POST', cache: 'no-store' })
  },
}
