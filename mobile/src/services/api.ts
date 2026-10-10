import type {
  AdvisoryRequest,
  AdvisoryResponse,
  CellRiskResponse,
  DroughtMapResponse,
  EnsoOutlookResponse,
  ErrorResponse,
  FarmAdvisory,
  FarmerDashboard,
  HealthResponse,
  LeadMonth,
  MinistryDashboard,
  TokenPair,
  WatershedBoundary,
} from '@agriminds/api-types';

import { loadRoleToken, saveRoleToken } from '@/storage/preferences';

import { getApiConfig } from './config';

export const REQUEST_TIMEOUT_MS = 8000;

export const DEMO_CREDENTIALS: Record<string, { identifier: string; password: string }> = {
  farmer: { identifier: '0912000001', password: 'AgriMinds#2026' },
  minister: { identifier: 'minister@moa.gov.et', password: 'AgriMinds#2026' },
  da: { identifier: 'agent.sinan@moa.gov.et', password: 'AgriMinds#2026' },
};

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
    if (res.status === 204) return undefined as T;
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

const tokenCache: Record<string, string> = {};

export async function getAuthTokenForRole(role: string): Promise<string | null> {
  if (tokenCache[role]) return tokenCache[role];
  const stored = await loadRoleToken(role);
  if (stored) {
    tokenCache[role] = stored;
    return stored;
  }
  const creds = DEMO_CREDENTIALS[role];
  if (creds) {
    try {
      const res = await api.login(creds.identifier, creds.password);
      tokenCache[role] = res.access_token;
      await saveRoleToken(role, res.access_token);
      return res.access_token;
    } catch {
      return null;
    }
  }
  return null;
}

export function clearTokenCache(role?: string) {
  if (role) delete tokenCache[role];
  else Object.keys(tokenCache).forEach((k) => delete tokenCache[k]);
}

async function authRequest<T>(role: string, path: string, init: RequestInit = {}): Promise<T> {
  let token = await getAuthTokenForRole(role);
  try {
    return await request<T>(path, {
      ...init,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch (err) {
    if (err instanceof ApiError && err.code === 'unauthorized') {
      clearTokenCache(role);
      await saveRoleToken(role, null);
      const creds = DEMO_CREDENTIALS[role];
      if (creds) {
        const res = await api.login(creds.identifier, creds.password);
        tokenCache[role] = res.access_token;
        await saveRoleToken(role, res.access_token);
        return await request<T>(path, {
          ...init,
          headers: {
            Authorization: `Bearer ${res.access_token}`,
            ...(init.headers ?? {}),
          },
        });
      }
    }
    throw err;
  }
}

export const api = {
  health: () => request<HealthResponse>('/health'),
  login: (identifier: string, password: string) =>
    request<TokenPair>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    }),
  droughtMap: (leadMonth: number) => request<DroughtMapResponse>(`/drought/map?lead_month=${leadMonth}`),
  cellRisk: (params: { lead_month: number; row?: number; col?: number; latitude?: number; longitude?: number }) =>
    request<CellRiskResponse>('/drought/cell', { method: 'POST', body: JSON.stringify(params) }),
  evaluateAdvisory: (payload: AdvisoryRequest) =>
    request<AdvisoryResponse>('/advisories/evaluate', { method: 'POST', body: JSON.stringify(payload) }),
  ensoOutlook: () => request<EnsoOutlookResponse>('/enso/outlook'),
  watershed: () => request<WatershedBoundary>('/drought/watershed'),

  // Role dashboards
  farmerDashboard: (leadMonth: LeadMonth, role: string = 'farmer') =>
    authRequest<FarmerDashboard>(role, `/dashboard/farmer?lead_month=${leadMonth}`),
  ministryDashboard: (leadMonth: LeadMonth, role: string = 'minister') =>
    authRequest<MinistryDashboard>(role, `/dashboard/ministry?lead_month=${leadMonth}`),
  farmAdvisory: (farmId: string, leadMonth: LeadMonth, role: string = 'farmer') =>
    authRequest<FarmAdvisory>(role, `/farms/${farmId}/advisory?lead_month=${leadMonth}`),
  acknowledgeAdvisory: (advisoryId: string, role: string = 'farmer') =>
    authRequest<void>(role, `/dashboard/farmer/advisories/${advisoryId}/acknowledge`, { method: 'POST' }),
};
