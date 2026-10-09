import { describe, expect, it } from 'vitest'
import { millisecondsUntilRenewal } from '@/features/analytics/MetabaseReport'

const NOW = Date.UTC(2026, 9, 9, 12, 0, 0)
const inMinutes = (n: number) => new Date(NOW + n * 60_000).toISOString()

describe('millisecondsUntilRenewal', () => {
  it('renews a few minutes before the URL dies, not at the last moment', () => {
    // A 60-minute URL is renewed at 57 minutes, leaving room for a slow network.
    expect(millisecondsUntilRenewal(inMinutes(60), NOW)).toBe(57 * 60_000)
  })

  it('renews on the next tick when the URL is already inside its lead window', () => {
    expect(millisecondsUntilRenewal(inMinutes(1), NOW)).toBe(1_000)
  })

  it('never schedules in the past, however stale the URL', () => {
    expect(millisecondsUntilRenewal(inMinutes(-30), NOW)).toBe(1_000)
  })

  it('clamps an expiry that could not be real, rather than sleeping for days', () => {
    // A wrong clock on the viewer's machine should not park the timer past the heat death.
    expect(millisecondsUntilRenewal(inMinutes(60 * 24 * 365), NOW)).toBe(2 * 60 * 60_000)
  })

  it('falls back to the cap when the expiry cannot be parsed', () => {
    expect(millisecondsUntilRenewal('not a date', NOW)).toBe(2 * 60 * 60_000)
  })
})
