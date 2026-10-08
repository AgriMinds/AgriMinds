import type {
  AdvisoryRequest,
  AdvisoryResponse,
  CellRiskResponse,
  DroughtMapResponse,
  EnsoOutlookResponse,
  ErrorResponse,
  HealthResponse,
  LeadMonth,
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
  if (!res.ok) throw await parseError(res)
  return (await res.json()) as T
}

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
}
