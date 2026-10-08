import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api } from '@/lib/api/client'

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

afterEach(() => vi.unstubAllGlobals())

describe('api client', () => {
  it('calls the same-origin proxy and returns typed JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { status: 'healthy' }))
    vi.stubGlobal('fetch', fetchMock)
    const health = await api.health()
    expect(health.status).toBe('healthy')
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/v1/health')
  })

  it('parses {error:{code,message}} into ApiError', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(503, { error: { code: 'model_unavailable', message: 'no weights' } }),
        ),
    )
    const err = await api.droughtMap(1).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).code).toBe('model_unavailable')
    expect((err as ApiError).message).toBe('no weights')
    expect((err as ApiError).isUnavailable).toBe(true)
  })

  it('handles FastAPI validation errors and non-JSON bodies', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(422, { detail: [{ loc: ['body'], msg: 'x' }] })),
    )
    const e1 = (await api
      .evaluateAdvisory({ crop: 'tef', lead_month: 1 })
      .catch((e: unknown) => e)) as ApiError
    expect(e1.code).toBe('validation_error')

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('gateway down', { status: 502, statusText: 'Bad Gateway' })),
    )
    const e2 = (await api.ensoOutlook().catch((e: unknown) => e)) as ApiError
    expect(e2.status).toBe(502)
    expect(e2.message).toBe('Bad Gateway')
  })

  it('sends POST bodies as JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { crop: 'maize' }))
    vi.stubGlobal('fetch', fetchMock)
    await api.evaluateAdvisory({ crop: 'maize', lead_month: 2, row: 1, col: 2 })
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toMatchObject({ crop: 'maize', lead_month: 2 })
  })
})
