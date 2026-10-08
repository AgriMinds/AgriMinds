import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { _resetRefreshState, refreshTokens } from '@/lib/server/upstream'

const PAIR = { access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 900 }

beforeEach(() => {
  _resetRefreshState()
  vi.restoreAllMocks()
})
afterEach(() => _resetRefreshState())

describe('refreshTokens', () => {
  it('spends a rotating refresh token exactly once for concurrent callers', async () => {
    // Replaying a rotated token revokes the whole session family upstream, so two requests
    // that race on the same 401 must share one refresh.
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify(PAIR), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const [first, second] = await Promise.all([refreshTokens('old-token'), refreshTokens('old-token')])

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(first).toEqual(PAIR)
    expect(second).toEqual(PAIR)
  })

  it('keeps separate sessions independent', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(PAIR), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await Promise.all([refreshTokens('session-a'), refreshTokens('session-b')])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('returns null when the service rejects the token', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })))
    await expect(refreshTokens('dead-token')).resolves.toBeNull()
  })

  it('returns null when the service cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNREFUSED') }))
    await expect(refreshTokens('any')).resolves.toBeNull()
  })

  it('allows a fresh attempt after the previous one settles', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(PAIR), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await refreshTokens('token')
    await new Promise((resolve) => setTimeout(resolve, 0)) // let the microtask cleanup run
    await refreshTokens('token')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
