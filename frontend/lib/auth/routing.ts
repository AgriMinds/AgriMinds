import type { Role } from '@agriminds/api-types'
import { homePathFor, isStaff } from '@agriminds/api-types'

export { homePathFor, isStaff }
export type { Role }

/** Paths that require a signed-in person. Everything else is public. */
export const PROTECTED_PREFIXES = ['/farm', '/ministry', '/watershed', '/analytics'] as const
export const LOGIN_PATH = '/login'

/** Protected paths a farmer must never reach; they are bounced to their own home. */
export const STAFF_PREFIXES = ['/ministry', '/watershed', '/analytics'] as const

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

/** Only same-origin absolute paths are honoured, so `?next=` cannot bounce a user off-site. */
export function safeNextPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null
  return value
}

/** Where to send a signed-in person who asked for `pathname`, or null to let them through. */
export function redirectForRole(role: Role, pathname: string): string | null {
  const home = homePathFor(role)
  if (pathname === '/' || pathname === LOGIN_PATH) return home
  if (pathname.startsWith('/farm') && role !== 'farmer') return home
  if (STAFF_PREFIXES.some((p) => pathname.startsWith(p)) && !isStaff(role)) return home
  return null
}
