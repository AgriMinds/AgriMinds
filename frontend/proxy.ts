import { NextResponse, type NextRequest } from 'next/server'
import type { Role } from '@agriminds/api-types'
import { LOGIN_PATH, isProtectedPath, redirectForRole } from '@/lib/auth/routing'
import { REFRESH_COOKIE, USER_COOKIE } from '@/lib/server/session'

/**
 * Optimistic routing only (Next.js calls this layer "Proxy"; it was "Middleware" before 16).
 *
 * It keeps signed-out visitors off the application shell and sends signed-in people to the
 * dashboard their role uses. It is deliberately not the security boundary: every figure on
 * those pages is fetched from the API, which verifies the access token on each call.
 */
function roleFromCookie(raw: string | undefined): Role | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw)
    return typeof value?.role === 'string' ? (value.role as Role) : null
  } catch {
    return null
  }
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl
  const signedIn = Boolean(request.cookies.get(REFRESH_COOKIE)?.value)
  const role = roleFromCookie(request.cookies.get(USER_COOKIE)?.value)

  if (!signedIn) {
    if (isProtectedPath(pathname)) {
      const url = request.nextUrl.clone()
      url.pathname = LOGIN_PATH
      url.search = ''
      url.searchParams.set('next', `${pathname}${search}`)
      return NextResponse.redirect(url)
    }
    return NextResponse.next()
  }

  if (role) {
    const target = redirectForRole(role, pathname)
    if (target && target !== pathname) {
      const url = request.nextUrl.clone()
      url.pathname = target
      url.search = ''
      return NextResponse.redirect(url)
    }
  }
  return NextResponse.next()
}

export const config = {
  // Everything except API routes, Next internals and static assets.
  matcher: ['/((?!api|_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|ico|webp|woff2?)$).*)'],
}
