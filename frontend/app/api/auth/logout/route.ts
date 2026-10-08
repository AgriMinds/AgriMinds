import { NextResponse, type NextRequest } from 'next/server'
import { REFRESH_COOKIE, clearSessionCookies } from '@/lib/server/session'
import { callUpstream } from '@/lib/server/upstream'

/** Revokes the session upstream and clears the cookies. Always succeeds from the caller's view. */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value
  if (refreshToken) {
    try {
      await callUpstream('auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: refreshToken }),
      })
    } catch {
      // The local cookies are cleared regardless; a stranded server-side session expires on its own.
    }
  }
  const res = new NextResponse(null, { status: 204 })
  clearSessionCookies(res.cookies)
  return res
}
