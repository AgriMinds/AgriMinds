import { NextResponse, type NextRequest } from 'next/server'
import type { TokenPair } from '@agriminds/api-types'
import { sessionUserFrom, tokensFromPair, writeSessionCookies } from '@/lib/server/session'
import { callUpstream } from '@/lib/server/upstream'

/**
 * Turns an invitation into a password and a session, in one step.
 *
 * This goes through its own handler rather than the generic proxy for the same reason sign-in
 * does: the upstream response carries access and refresh tokens, and they belong in httpOnly
 * cookies, not in a body the browser bundle can read.
 *
 * The token travels in the URL path, which is where the invitation link puts it. That is also why
 * it is single-use and short-lived upstream -- a URL ends up in history and in logs.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await params
  let payload: { password?: unknown }
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: { code: 'bad_request', message: 'Invalid request.' } }, { status: 400 })
  }
  const password = typeof payload.password === 'string' ? payload.password : ''
  if (!token || !password) {
    return NextResponse.json(
      { error: { code: 'validation_error', message: 'Choose a password.' } },
      { status: 422 },
    )
  }

  let upstream: Response
  try {
    upstream = await callUpstream(`auth/invitations/${encodeURIComponent(token)}`, {
      method: 'POST',
      body: JSON.stringify({ password }),
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
  const res = NextResponse.json({ user: pair.user })
  writeSessionCookies(res.cookies, tokensFromPair(pair), sessionUserFrom(pair.user))
  return res
}
