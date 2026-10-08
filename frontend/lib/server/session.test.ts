import { describe, expect, it, vi } from 'vitest'
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  USER_COOKIE,
  clearSessionCookies,
  decodeJwtPayload,
  sessionUserFrom,
  writeSessionCookies,
} from '@/lib/server/session'

function fakeJar() {
  return { set: vi.fn(), delete: vi.fn() }
}

const tokens = { access_token: 'a.b.c', refresh_token: 'refresh-value', expires_in: 900 }

describe('decodeJwtPayload', () => {
  it('reads a payload without verifying the signature', () => {
    const payload = { sub: 'user-1', role: 'farmer', name: 'Abebe' }
    const token = `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`
    expect(decodeJwtPayload(token)).toMatchObject(payload)
  })

  it('returns null for anything that is not a JWT', () => {
    expect(decodeJwtPayload('nonsense')).toBeNull()
    expect(decodeJwtPayload('a.!!!.c')).toBeNull()
  })
})

describe('writeSessionCookies', () => {
  it('stores both tokens httpOnly and never exposes them to scripts', () => {
    const jar = fakeJar()
    writeSessionCookies(jar, tokens, { id: '1', role: 'minister', name: 'Office', locale: 'en' })

    const names = jar.set.mock.calls.map((c) => c[0])
    expect(names).toEqual([ACCESS_COOKIE, REFRESH_COOKIE, USER_COOKIE])
    for (const call of jar.set.mock.calls) {
      expect(call[2]).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/' })
    }
  })

  it('ties the access cookie to the token lifetime and keeps the refresh cookie long-lived', () => {
    const jar = fakeJar()
    writeSessionCookies(jar, tokens)
    expect(jar.set.mock.calls[0]?.[2]).toMatchObject({ maxAge: 900 })
    expect(jar.set.mock.calls[1]?.[2]).toMatchObject({ maxAge: 60 * 60 * 24 * 14 })
  })

  it('leaves the user cookie alone when no user is supplied (token rotation)', () => {
    const jar = fakeJar()
    writeSessionCookies(jar, tokens)
    expect(jar.set.mock.calls.map((c) => c[0])).not.toContain(USER_COOKIE)
  })
})

describe('clearSessionCookies', () => {
  it('removes every session cookie', () => {
    const jar = fakeJar()
    clearSessionCookies(jar)
    expect(jar.delete.mock.calls.map((c) => c[0])).toEqual([ACCESS_COOKIE, REFRESH_COOKIE, USER_COOKIE])
  })
})

describe('sessionUserFrom', () => {
  it('keeps only what routing and the shell need', () => {
    expect(
      sessionUserFrom({
        id: 'u1',
        email: 'minister@moa.gov.et',
        phone: null,
        full_name: 'Ministry',
        role: 'minister',
        locale: 'en',
        is_active: true,
        last_login_at: null,
      }),
    ).toEqual({ id: 'u1', role: 'minister', name: 'Ministry', locale: 'en' })
  })
})
