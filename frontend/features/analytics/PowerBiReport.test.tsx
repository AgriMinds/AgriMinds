import { useEffect } from 'react'
import { render, screen, act } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EmbedConfig } from '@agriminds/api-types'
import messages from '@/messages/en.json'

/** Counts mounts so a test can prove the iframe was not torn down and rebuilt. */
const mounts = { count: 0 }
const setAccessToken = vi.fn<(token: string) => Promise<void>>()

vi.mock('powerbi-client', () => ({
  models: {
    TokenType: { Embed: 1 },
    BackgroundType: { Transparent: 1 },
    LayoutType: { Custom: 2 },
    DisplayOption: { FitToWidth: 1 },
  },
}))

vi.mock('powerbi-client-react', () => ({
  PowerBIEmbed: ({
    embedConfig,
    getEmbeddedComponent,
  }: {
    embedConfig: { accessToken: string }
    getEmbeddedComponent?: (o: unknown) => void
  }) => {
    // Counted in an effect with no dependencies, so this is mounts and not renders.
    useEffect(() => {
      mounts.count += 1
    }, [])
    getEmbeddedComponent?.({ setAccessToken })
    return <div data-testid="embed" data-token={embedConfig.accessToken} />
  },
}))

const { PowerBiReport, millisecondsUntilRenewal } = await import('@/features/analytics/PowerBiReport')

const config = (overrides: Partial<EmbedConfig> = {}): EmbedConfig => ({
  report_id: 'report-1',
  embed_url: 'https://app.powerbi.com/reportEmbed?reportId=report-1',
  access_token: 'token-one',
  expires_at: new Date(Date.now() + 50 * 60_000).toISOString(),
  scope: 'Whole watershed',
  rls_applied: false,
  ...overrides,
})

const wrap = (ui: React.ReactNode) =>
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  )

beforeEach(() => {
  mounts.count = 0
  setAccessToken.mockReset()
  setAccessToken.mockResolvedValue(undefined)
})
afterEach(() => vi.useRealTimers())

describe('millisecondsUntilRenewal', () => {
  it('schedules two minutes before the token expires', () => {
    const now = Date.now()
    const expires = new Date(now + 50 * 60_000).toISOString()
    expect(millisecondsUntilRenewal(expires, now)).toBe(48 * 60_000)
  })

  it('renews almost immediately when the token is already inside its lead window', () => {
    const now = Date.now()
    expect(millisecondsUntilRenewal(new Date(now + 30_000).toISOString(), now)).toBe(1_000)
    expect(millisecondsUntilRenewal(new Date(now - 60_000).toISOString(), now)).toBe(1_000)
  })

  it('clamps an impossible expiry rather than waiting on a wrong clock', () => {
    const now = Date.now()
    const absurd = new Date(now + 10 * 60 * 60_000).toISOString()
    expect(millisecondsUntilRenewal(absurd, now)).toBe(60 * 60_000)
  })

  it('falls back to the cap rather than NaN on an unparseable timestamp', () => {
    expect(millisecondsUntilRenewal('not a date', Date.now())).toBe(60 * 60_000)
  })
})

describe('PowerBiReport', () => {
  it('renews before the token expires rather than on a fixed interval', () => {
    vi.useFakeTimers()
    const onRenew = vi.fn()
    wrap(<PowerBiReport config={config()} onRenew={onRenew} isRenewing={false} />)

    act(() => void vi.advanceTimersByTime(47 * 60_000))
    expect(onRenew).not.toHaveBeenCalled()

    act(() => void vi.advanceTimersByTime(60_000 + 100))
    expect(onRenew).toHaveBeenCalledTimes(1)
  })

  it('pushes a renewed token into the live report instead of remounting the iframe', async () => {
    const { rerender } = wrap(<PowerBiReport config={config()} onRenew={vi.fn()} isRenewing={false} />)
    expect(mounts.count).toBe(1)
    expect(screen.getByTestId('embed')).toHaveAttribute('data-token', 'token-one')

    rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <PowerBiReport
          config={config({ access_token: 'token-two' })}
          onRenew={vi.fn()}
          isRenewing={false}
        />
      </NextIntlClientProvider>,
    )

    expect(setAccessToken).toHaveBeenCalledWith('token-two')
    expect(mounts.count).toBe(1)
    // The frozen config is what keeps the viewer's place; it must still hold the first token.
    expect(screen.getByTestId('embed')).toHaveAttribute('data-token', 'token-one')
  })

  it('says which rows the viewer is seeing, and flags a server-enforced restriction', () => {
    wrap(
      <PowerBiReport
        config={config({ scope: 'Sinan woreda only', rls_applied: true })}
        onRenew={vi.fn()}
        isRenewing={false}
      />,
    )
    expect(screen.getByText(/Sinan woreda only/)).toBeInTheDocument()
    expect(screen.getByText('Restricted by the server')).toBeInTheDocument()
  })

  it('does not claim a restriction when the server applied none', () => {
    wrap(<PowerBiReport config={config()} onRenew={vi.fn()} isRenewing={false} />)
    expect(screen.queryByText('Restricted by the server')).not.toBeInTheDocument()
  })

  it('tells the viewer when a renewal is in flight', () => {
    wrap(<PowerBiReport config={config()} onRenew={vi.fn()} isRenewing />)
    expect(screen.getByRole('status')).toHaveTextContent('Renewing access…')
  })
})
