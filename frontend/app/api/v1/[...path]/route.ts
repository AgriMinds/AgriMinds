import type { NextRequest } from 'next/server'

/**
 * Same-origin proxy to the FastAPI service.
 * - The browser never learns the backend host and never holds the API key.
 * - Only the documented read/evaluate paths are forwarded; everything else is 404.
 * - Nothing is cached here: forecasts carry their own `provenance.issued_date`.
 */
const UPSTREAM = (process.env.API_INTERNAL_URL ?? 'http://localhost:8000').replace(/\/$/, '')
const ALLOWED: ReadonlyArray<{ method: 'GET' | 'POST'; path: RegExp }> = [
  { method: 'GET', path: /^health(\/ready)?$/ },
  { method: 'GET', path: /^drought\/(map|cell)$/ },
  { method: 'POST', path: /^drought\/cell$/ },
  { method: 'POST', path: /^advisories\/evaluate$/ },
  { method: 'GET', path: /^enso\/outlook$/ },
]
const TIMEOUT_MS = 15_000

function errorJson(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status })
}

async function forward(req: NextRequest, ctx: RouteContext<'/api/v1/[...path]'>, method: 'GET' | 'POST') {
  const { path } = await ctx.params
  const joined = path.join('/')
  if (!ALLOWED.some((r) => r.method === method && r.path.test(joined))) {
    return errorJson(404, 'not_found', 'Unknown API path')
  }
  const url = `${UPSTREAM}/api/v1/${joined}${req.nextUrl.search}`
  const headers = new Headers({ Accept: 'application/json' })
  if (process.env.API_KEY) headers.set('X-API-Key', process.env.API_KEY)
  const requestId = req.headers.get('x-request-id')
  if (requestId) headers.set('X-Request-ID', requestId)
  let body: string | undefined
  if (method === 'POST') {
    headers.set('Content-Type', 'application/json')
    body = await req.text()
  }
  try {
    const upstream = await fetch(url, {
      method,
      headers,
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    const out = new Headers({ 'Cache-Control': 'no-store' })
    const type = upstream.headers.get('content-type')
    if (type) out.set('Content-Type', type)
    const rid = upstream.headers.get('x-request-id')
    if (rid) out.set('X-Request-ID', rid)
    return new Response(upstream.body, { status: upstream.status, headers: out })
  } catch (err) {
    const timedOut = err instanceof Error && err.name === 'TimeoutError'
    return errorJson(
      timedOut ? 504 : 502,
      timedOut ? 'upstream_timeout' : 'upstream_unreachable',
      'The forecast service did not respond.',
    )
  }
}

export async function GET(req: NextRequest, ctx: RouteContext<'/api/v1/[...path]'>) {
  return forward(req, ctx, 'GET')
}

export async function POST(req: NextRequest, ctx: RouteContext<'/api/v1/[...path]'>) {
  return forward(req, ctx, 'POST')
}
