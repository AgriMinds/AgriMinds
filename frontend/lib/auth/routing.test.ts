import { describe, expect, it } from 'vitest'
import { homePathFor, isProtectedPath, redirectForRole, safeNextPath } from '@/lib/auth/routing'

describe('homePathFor', () => {
  it('sends a farmer to their farm and everyone else to the ministry view', () => {
    expect(homePathFor('farmer')).toBe('/farm')
    expect(homePathFor('agent')).toBe('/ministry')
    expect(homePathFor('minister')).toBe('/ministry')
    expect(homePathFor('admin')).toBe('/ministry')
  })
})

describe('isProtectedPath', () => {
  it('covers the application shell but not the public pages', () => {
    expect(isProtectedPath('/farm')).toBe(true)
    expect(isProtectedPath('/ministry/anything')).toBe(true)
    expect(isProtectedPath('/watershed')).toBe(true)
    expect(isProtectedPath('/login')).toBe(false)
    expect(isProtectedPath('/')).toBe(false)
  })
})

describe('safeNextPath', () => {
  it('accepts same-origin paths only', () => {
    expect(safeNextPath('/ministry')).toBe('/ministry')
    expect(safeNextPath('//evil.example')).toBeNull()
    expect(safeNextPath('https://evil.example')).toBeNull()
    expect(safeNextPath(undefined)).toBeNull()
  })
})

describe('redirectForRole', () => {
  it('keeps each role on the dashboard it is allowed to see', () => {
    expect(redirectForRole('farmer', '/ministry')).toBe('/farm')
    expect(redirectForRole('farmer', '/watershed')).toBe('/farm')
    expect(redirectForRole('minister', '/farm')).toBe('/ministry')
    expect(redirectForRole('agent', '/watershed')).toBeNull()
    expect(redirectForRole('farmer', '/farm')).toBeNull()
  })

  it('moves a signed-in person off the entry and sign-in pages', () => {
    expect(redirectForRole('farmer', '/')).toBe('/farm')
    expect(redirectForRole('minister', '/login')).toBe('/ministry')
  })
})
