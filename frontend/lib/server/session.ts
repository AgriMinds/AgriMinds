import 'server-only'

import { cookies } from 'next/headers'
import type { ResponseCookies } from 'next/dist/compiled/@edge-runtime/cookies'
import type { Role, TokenPair, User } from '@agriminds/api-types'

/**
 * Session state lives in three httpOnly cookies. Nothing is readable by client JavaScript and
 * no token ever reaches the browser bundle.
 *
 *  agriminds_at   short-lived access token, sent upstream as `Authorization: Bearer`
 *  agriminds_rt   long-lived refresh token; rotates on every use
 *  agriminds_user non-secret {id, role, name, locale} used only to choose a route and label the UI
 *
 * The API verifies every access token, so these cookies are a routing convenience, not a
 * security boundary: a forged `agriminds_user` buys an empty shell whose data calls all 401.
 */
export const ACCESS_COOKIE = 'agriminds_at'
export const REFRESH_COOKIE = 'agriminds_rt'
export const USER_COOKIE = 'agriminds_user'

const REFRESH_MAX_AGE = 60 * 60 * 24 * 14 // must match AGRIMINDS_REFRESH_TOKEN_TTL_DAYS

export type SessionUser = { id: string; role: Role; name: string; locale: string }
export type Session = { accessToken: string | null; refreshToken: string; user: SessionUser }

type CookieJar = Pick<ResponseCookies, 'set' | 'delete'>

function baseCookie(maxAge: number) {
  const secure =
    process.env.COOKIE_SECURE === 'true' ||
    (process.env.NODE_ENV === 'production' &&
      process.env.COOKIE_SECURE !== 'false' &&
      process.env.AGRIMINDS_ENV === 'production')
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge,
  } as const
}

/** Reads a JWT's payload WITHOUT verifying it. Signature checking is the API's job. */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const part = token.split('.')[1]
  if (!part) return null
  try {
    const json = Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
    const payload = JSON.parse(json)
    return typeof payload === 'object' && payload !== null ? payload : null
  } catch {
    return null
  }
}

export function sessionUserFrom(user: User): SessionUser {
  return { id: user.id, role: user.role, name: user.full_name, locale: user.locale }
}

function parseUserCookie(raw: string | undefined): SessionUser | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw)
    if (value && typeof value.id === 'string' && typeof value.role === 'string') {
      return { id: value.id, role: value.role, name: String(value.name ?? ''), locale: String(value.locale ?? 'en') }
    }
  } catch {
    /* tampered or truncated cookie: treat as signed out */
  }
  return null
}

/** The current session, or null when the person is signed out. */
export async function getSession(): Promise<Session | null> {
  const jar = await cookies()
  const refreshToken = jar.get(REFRESH_COOKIE)?.value
  if (!refreshToken) return null
  const accessToken = jar.get(ACCESS_COOKIE)?.value ?? null

  let user = parseUserCookie(jar.get(USER_COOKIE)?.value)
  if (!user && accessToken) {
    const claims = decodeJwtPayload(accessToken)
    if (claims && typeof claims.sub === 'string' && typeof claims.role === 'string') {
      user = {
        id: claims.sub,
        role: claims.role as Role,
        name: String(claims.name ?? ''),
        locale: String(claims.locale ?? 'en'),
      }
    }
  }
  return user ? { accessToken, refreshToken, user } : null
}

export function writeSessionCookies(
  jar: CookieJar,
  tokens: { access_token: string; refresh_token: string; expires_in: number },
  user?: SessionUser,
): void {
  jar.set(ACCESS_COOKIE, tokens.access_token, baseCookie(Math.max(tokens.expires_in, 60)))
  jar.set(REFRESH_COOKIE, tokens.refresh_token, baseCookie(REFRESH_MAX_AGE))
  if (user) jar.set(USER_COOKIE, JSON.stringify(user), baseCookie(REFRESH_MAX_AGE))
}

export function clearSessionCookies(jar: CookieJar): void {
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, USER_COOKIE]) jar.delete(name)
}

export function tokensFromPair(pair: TokenPair) {
  return { access_token: pair.access_token, refresh_token: pair.refresh_token, expires_in: pair.expires_in }
}
