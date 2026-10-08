import { NextResponse, type NextRequest } from 'next/server'
import type { TokenPair } from '@agriminds/api-types'
import { sessionUserFrom, tokensFromPair, writeSessionCookies } from '@/lib/server/session'
import { callUpstream } from '@/lib/server/upstream'

/**
 * Exchanges credentials for a session.
 *
 * Tokens are written straight into httpOnly cookies and are never included in the response
 * body, so the browser bundle has no way to read or leak them.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let payload: { identifier?: unknown; password?: unknown }
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: { code: 'bad_request', message: 'Invalid request.' } }, { status: 400 })
  }
  const identifier = typeof payload.identifier === 'string' ? payload.identifier.trim() : ''
  const password = typeof payload.password === 'string' ? payload.password : ''
  if (!identifier || !password) {
    return NextResponse.json(
      { error: { code: 'validation_error', message: 'Enter your account and password.' } },
      { status: 422 },
    )
  }

  let upstream: Response
  try {
    upstream = await callUpstream('auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    })
  } catch {
    return NextResponse.json(
      { error: { code: 'upstream_unreachable', message: 'The service did not respond. Try again.' } },
      { status: 502 },
    )
  }

  if (!upstream.ok) {
    const body = await upstream.text()
    return new NextResponse(body, {
      status: upstream.status,
      headers: { 'Content-Type': upstream.headers.get('content-type') ?? 'application/json' },
    })
  }

  const pair = (await upstream.json()) as TokenPair
  const user = sessionUserFrom(pair.user)
  const res = NextResponse.json({ user: pair.user })
  writeSessionCookies(res.cookies, tokensFromPair(pair), user)
  return res
}
