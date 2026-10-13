import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isAllowed, type Method } from './api-routes'

/**
 * The proxy denies by default, so every endpoint added to the API and the client needs a third
 * edit here. Forgetting it produces "Unknown API path" at runtime on a page that type-checks,
 * builds and passes its own unit tests — which is exactly how `crop-yield/timeline` and the whole
 * billing surface shipped broken.
 *
 * So the client is read as text and every path it calls is checked against the allowlist. The
 * template holes (`${id}`, `${suffix}`) are filled with a representative value first, because what
 * matters is whether the shape is permitted, not the literal.
 */

const CLIENT = readFileSync(join(process.cwd(), 'lib/api/client.ts'), 'utf8')

const SAMPLE: Record<string, string> = {
  id: '11111111-2222-3333-4444-555555555555',
  keyId: '66666666-7777-8888-9999-000000000000',
  advisoryId: '99999999-8888-7777-6666-555555555555',
  stakeholder: 'regional_government',
}

/** `request<T>('/path')` and `request<T>(`/path${x}`)`, with the method if one is given. */
function callsInClient(): Array<{ method: Method; path: string }> {
  const calls: Array<{ method: Method; path: string }> = []
  const re = /request<[^>]*>\(\s*([`'])([^`']+)\1([\s\S]{0,160}?)\)/g
  for (const match of CLIENT.matchAll(re)) {
    const raw = match[2]!
    const tail = match[3] ?? ''
    const method = (/method:\s*'(GET|POST|PATCH|DELETE)'/.exec(tail)?.[1] ?? 'GET') as Method
    // Fill template holes with a value of the right shape, then drop query strings.
    const filled = raw
      .replace(/\$\{(\w+)[^}]*\}/g, (_m, name: string) => SAMPLE[name] ?? 'x')
      .replace(/\?.*$/, '')
      .replace(/^\//, '')
    if (filled) calls.push({ method, path: filled })
  }
  return calls
}

describe('the proxy allowlist', () => {
  it('finds the calls in the client at all', () => {
    // If the regex stops matching, every other assertion here passes vacuously.
    const calls = callsInClient()
    expect(calls.length).toBeGreaterThan(10)
    expect(calls.map((c) => c.path)).toContain('drought/map')
  })

  it('permits every path the client calls', () => {
    const missing = callsInClient().filter(({ method, path }) => !isAllowed(method, path))
    expect(missing).toEqual([])
  })

  it('still refuses anything nobody listed', () => {
    expect(isAllowed('GET', 'billing/pricing')).toBe(true)
    expect(isAllowed('DELETE', 'billing/pricing')).toBe(false)
    expect(isAllowed('GET', 'admin/secrets')).toBe(false)
    // A path segment that should be a UUID must not accept anything else.
    expect(isAllowed('GET', 'organizations/not-a-uuid/usage')).toBe(false)
  })
})
