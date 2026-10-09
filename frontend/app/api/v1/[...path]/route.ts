import { NextResponse, type NextRequest } from 'next/server'
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  clearSessionCookies,
  writeSessionCookies,
} from '@/lib/server/session'
import { callUpstream, refreshTokens } from '@/lib/server/upstream'

/**
 * Same-origin proxy to the FastAPI service.
 *
 * - The browser never learns the backend host and never holds a token.
 * - Only documented paths are forwarded; anything else is 404.
 * - The access token is attached from an httpOnly cookie. If it is missing or the service
 *   rejects it, the refresh token is spent exactly once and the original request is retried.
 * - Nothing is cached: forecasts carry their own `provenance.issued_date`.
 */
const UUID = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE'

const ALLOWED: ReadonlyArray<{ method: Method; path: RegExp }> = [
  { method: 'GET', path: /^health(\/ready)?$/ },
  { method: 'GET', path: /^drought\/(map|cell|watershed|horizon|metrics)$/ },
  { method: 'POST', path: /^drought\/cell$/ },
  { method: 'POST', path: /^advisories\/evaluate$/ },
  { method: 'GET', path: /^enso\/outlook$/ },
  // account
  { method: 'GET', path: /^auth\/me$/ },
  { method: 'PATCH', path: /^auth\/me$/ },
  { method: 'POST', path: /^auth\/me\/password$/ },
  // farms
  { method: 'GET', path: /^farms$/ },
  { method: 'POST', path: /^farms$/ },
  { method: 'GET', path: new RegExp(`^farms/${UUID}$`) },
  { method: 'PATCH', path: new RegExp(`^farms/${UUID}$`) },
  { method: 'DELETE', path: new RegExp(`^farms/${UUID}$`) },
  { method: 'GET', path: new RegExp(`^farms/${UUID}/advisory$`) },
  // what the platform is built from (staff)
  { method: 'GET', path: /^system\/data-sources$/ },
  // dashboards
  { method: 'GET', path: /^dashboard\/(farmer|ministry)$/ },
  { method: 'POST', path: new RegExp(`^dashboard/farmer/advisories/${UUID}/acknowledge$`) },
  // analytics (staff; the service enforces the role and, where configured, the district scope)
  { method: 'GET', path: /^analytics\/metabase\/(status|embed)$/ },
  { method: 'GET', path: /^analytics\/connection$/ },
]

function errorJson(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status })
}

async function toResponse(upstream: Response): Promise<NextResponse> {
  // Buffered rather than streamed so cookies can still be attached to the response.
  const body = upstream.status === 204 ? null : await upstream.arrayBuffer()
  const headers = new Headers({ 'Cache-Control': 'no-store' })
  const type = upstream.headers.get('content-type')
  if (type) headers.set('Content-Type', type)
  const rid = upstream.headers.get('x-request-id')
  if (rid) headers.set('X-Request-ID', rid)
  // Carried through so any file response still downloads under its own name.
  const disposition = upstream.headers.get('content-disposition')
  if (disposition) headers.set('Content-Disposition', disposition)
  return new NextResponse(body, { status: upstream.status, headers })
}

async function forward(
  req: NextRequest,
  ctx: RouteContext<'/api/v1/[...path]'>,
  method: Method,
): Promise<NextResponse> {
  const { path } = await ctx.params
  const joined = path.join('/')
  if (!ALLOWED.some((r) => r.method === method && r.path.test(joined))) {
    return errorJson(404, 'not_found', 'Unknown API path')
  }

  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value ?? null
  let accessToken = req.cookies.get(ACCESS_COOKIE)?.value ?? null
  const body = method === 'POST' || method === 'PATCH' ? await req.text() : undefined
  const search = req.nextUrl.search
  const requestId = req.headers.get('x-request-id')

  let rotated: Awaited<ReturnType<typeof refreshTokens>> = null
  let refreshFailed = false

  // The access cookie expires before the refresh cookie, so renew first instead of
  // spending a guaranteed 401 on the service.
  if (!accessToken && refreshToken) {
    rotated = await refreshTokens(refreshToken)
    if (rotated) accessToken = rotated.access_token
    else refreshFailed = true
  }

  let upstream: Response
  try {
    upstream = await callUpstream(joined, { method, body, accessToken, requestId, search })
    if (upstream.status === 401 && refreshToken && !rotated && !refreshFailed) {
      rotated = await refreshTokens(refreshToken)
      if (rotated) {
        accessToken = rotated.access_token
        upstream = await callUpstream(joined, { method, body, accessToken, requestId, search })
      } else {
        refreshFailed = true
      }
    }
  } catch (err) {
    const timedOut = err instanceof Error && err.name === 'TimeoutError'
    return errorJson(
      timedOut ? 504 : 502,
      timedOut ? 'upstream_timeout' : 'upstream_unreachable',
      'The forecast service did not respond.',
    )
  }

  const res = await toResponse(upstream)
  if (rotated) writeSessionCookies(res.cookies, rotated)
  // The session is unrecoverable: clear it so the next navigation lands on the sign-in page.
  if (refreshFailed || (upstream.status === 401 && refreshToken)) clearSessionCookies(res.cookies)
  return res
}

export async function GET(req: NextRequest, ctx: RouteContext<'/api/v1/[...path]'>) {
  return forward(req, ctx, 'GET')
}
export async function POST(req: NextRequest, ctx: RouteContext<'/api/v1/[...path]'>) {
  return forward(req, ctx, 'POST')
}
export async function PATCH(req: NextRequest, ctx: RouteContext<'/api/v1/[...path]'>) {
  return forward(req, ctx, 'PATCH')
}
export async function DELETE(req: NextRequest, ctx: RouteContext<'/api/v1/[...path]'>) {
  return forward(req, ctx, 'DELETE')
}
