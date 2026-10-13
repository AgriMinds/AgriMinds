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

/**
 * Template holes are of two kinds and must not be treated alike.
 *
 * PATH_PARAMS sit inside the path and decide which rule should match, so they are filled with a
 * value of the right shape. SUFFIXES are query strings a helper appends (`?lead_month=3`) and
 * never affect routing, so they are blanked. A hole in neither list fails the test rather than
 * being guessed at: a new path parameter that silently became an empty string would let this
 * guard pass while the real call 404s.
 */
const PATH_PARAMS: Record<string, string> = {
  id: '11111111-2222-3333-4444-555555555555',
  keyId: '66666666-7777-8888-9999-000000000000',
  advisoryId: '99999999-8888-7777-6666-555555555555',
  stakeholder: 'regional_government',
}
const SUFFIXES = ['suffix', 'lead', 'includeHistory', 'throughYear', 'q']

function holeName(expr: string): string {
  return /^\s*(\w+)/.exec(expr)?.[1] ?? ''
}

/**
 * Replace every `${…}` with its stand-in, counting braces rather than matching a regex: a hole
 * like `${n ? `?x=${n}` : ''}` nests, and `[^}]*` stops at the inner brace and mangles the path.
 */
function fillHoles(raw: string): string {
  let out = ''
  for (let i = 0; i < raw.length; i += 1) {
    if (raw[i] !== '$' || raw[i + 1] !== '{') {
      out += raw[i]
      continue
    }
    let depth = 0
    let j = i + 1
    for (; j < raw.length; j += 1) {
      if (raw[j] === '{') depth += 1
      else if (raw[j] === '}' && (depth -= 1) === 0) break
    }
    const name = holeName(raw.slice(i + 2, j))
    out += name in PATH_PARAMS ? PATH_PARAMS[name]! : SUFFIXES.includes(name) ? '' : `UNKNOWN_HOLE:${name}`
    i = j
  }
  return out
}

/** `request<T>('/path')` and `request<T>(`/path${x}`)`, with the method if one is given. */
function callsInClient(): Array<{ method: Method; path: string }> {
  const calls: Array<{ method: Method; path: string }> = []
  const re = /request<[^>]*>\(\s*([`'])([^`']+)\1([\s\S]{0,160}?)\)/g
  for (const match of CLIENT.matchAll(re)) {
    const raw = match[2]!
    const tail = match[3] ?? ''
    const method = (/method:\s*'(GET|POST|PATCH|DELETE)'/.exec(tail)?.[1] ?? 'GET') as Method
    const filled = fillHoles(raw)
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

  it('recognises every template hole, instead of guessing at a new one', () => {
    // A hole nobody classified would otherwise be blanked and quietly pass.
    const unknown = callsInClient().filter((c) => c.path.includes('UNKNOWN_HOLE:'))
    expect(unknown).toEqual([])
  })

  it('still refuses anything nobody listed', () => {
    expect(isAllowed('GET', 'billing/pricing')).toBe(true)
    expect(isAllowed('DELETE', 'billing/pricing')).toBe(false)
    expect(isAllowed('GET', 'admin/secrets')).toBe(false)
    // A path segment that should be a UUID must not accept anything else.
    expect(isAllowed('GET', 'organizations/not-a-uuid/usage')).toBe(false)
  })
})
