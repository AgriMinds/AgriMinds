import type {
  AdvisoryRequest,
  AdvisoryResponse,
  CellRiskResponse,
  DroughtMapResponse,
  EnsoOutlookResponse,
  ErrorResponse,
  HealthResponse,
} from '@agriminds/api-types';

import { getApiConfig } from './config';

export const REQUEST_TIMEOUT_MS = 8000;

export type ApiErrorCode =
  | 'network'
  | 'timeout'
  | 'unauthorized'
  | 'model_unavailable'
  | 'invalid_location'
  | 'validation'
  | 'http'
  | 'unknown';

export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function isErrorResponse(body: unknown): body is ErrorResponse {
  return !!body && typeof body === 'object' && 'error' in body && typeof (body as ErrorResponse).error?.code === 'string';
}

/** Maps an HTTP status + parsed body to a typed ApiError. Exported for unit tests. */
export function parseApiError(status: number, body: unknown): ApiError {
  if (isErrorResponse(body)) {
    const { code, message } = body.error;
    if (code === 'unauthorized') return new ApiError('unauthorized', message, status);
    if (code === 'model_unavailable') return new ApiError('model_unavailable', message, status);
    if (code === 'invalid_location') return new ApiError('invalid_location', message, status);
    return new ApiError('http', message, status);
  }
  if (status === 401 || status === 403) return new ApiError('unauthorized', 'Unauthorized', status);
  if (status === 422) return new ApiError('validation', 'Invalid request', status);
  if (status === 503) return new ApiError('model_unavailable', 'Service unavailable', status);
  return new ApiError('http', `HTTP ${status}`, status);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { baseUrl, apiKey } = await getApiConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(apiKey ? { 'X-API-Key': apiKey } : {}),
        ...(init.headers ?? {}),
      },
    });
    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) throw parseApiError(res.status, body);
    return body as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof Error && err.name === 'AbortError') throw new ApiError('timeout', 'Request timed out');
    throw new ApiError('network', err instanceof Error ? err.message : 'Network error');
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  health: () => request<HealthResponse>('/health'),
  droughtMap: (leadMonth: number) => request<DroughtMapResponse>(`/drought/map?lead_month=${leadMonth}`),
  cellRisk: (params: { lead_month: number; row?: number; col?: number; latitude?: number; longitude?: number }) =>
    request<CellRiskResponse>('/drought/cell', { method: 'POST', body: JSON.stringify(params) }),
  evaluateAdvisory: (payload: AdvisoryRequest) =>
    request<AdvisoryResponse>('/advisories/evaluate', { method: 'POST', body: JSON.stringify(payload) }),
  ensoOutlook: () => request<EnsoOutlookResponse>('/enso/outlook'),
};
