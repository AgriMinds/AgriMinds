import 'server-only'

/** Server-side calls to the FastAPI service. The browser never sees this host. */
export const UPSTREAM = (process.env.API_INTERNAL_URL ?? 'http://localhost:8000').replace(/\/$/, '')
export const UPSTREAM_TIMEOUT_MS = 15_000

export type UpstreamInit = {
  method: string
  body?: string
  accessToken?: string | null
  requestId?: string | null
  search?: string
}

export function upstreamUrl(path: string, search = ''): string {
  return `${UPSTREAM}/api/v1/${path}${search}`
}

export async function callUpstream(path: string, init: UpstreamInit): Promise<Response> {
  const headers = new Headers({ Accept: 'application/json' })
  if (init.accessToken) headers.set('Authorization', `Bearer ${init.accessToken}`)
  // The service key still covers calls made with no signed-in person (none today, but the
  // backend keeps accepting it so the mobile app and scripts work the same way).
  else if (process.env.API_KEY) headers.set('X-API-Key', process.env.API_KEY)
  if (init.requestId) headers.set('X-Request-ID', init.requestId)
  if (init.body !== undefined) headers.set('Content-Type', 'application/json')

  return fetch(upstreamUrl(path, init.search), {
    method: init.method,
    headers,
    body: init.body,
    cache: 'no-store',
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  })
}

export type RefreshedTokens = { access_token: string; refresh_token: string; expires_in: number }

/**
 * In-flight refreshes, keyed by the refresh token being spent.
 *
 * Refresh tokens rotate and replaying one revokes the whole session family, so two requests
 * that both hit 401 with the same token must share a single upstream refresh. Keying by token
 * (rather than one global lock) keeps concurrent sessions independent.
 */
const inFlight = new Map<string, Promise<RefreshedTokens | null>>()

export function refreshTokens(refreshToken: string): Promise<RefreshedTokens | null> {
  const existing = inFlight.get(refreshToken)
  if (existing) return existing

  const pending = (async (): Promise<RefreshedTokens | null> => {
    try {
      const res = await callUpstream('auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: refreshToken }),
      })
      if (!res.ok) return null
      const data = (await res.json()) as RefreshedTokens
      return data.access_token && data.refresh_token ? data : null
    } catch {
      return null
    } finally {
      // Delay removal to the next tick so late joiners still find the shared promise.
      queueMicrotask(() => inFlight.delete(refreshToken))
    }
  })()

  inFlight.set(refreshToken, pending)
  return pending
}

/** Test seam. */
export function _resetRefreshState(): void {
  inFlight.clear()
}
