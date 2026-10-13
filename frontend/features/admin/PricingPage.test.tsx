import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FORMATS } from '@/i18n/config'
import messages from '@/messages/en.json'

const catalogueQuery = vi.fn()
const historyQuery = vi.fn()
const repriceMutation = vi.fn()
vi.mock('@/features/admin/usePricing', () => ({
  pricingKeys: { catalogue: () => ['billing', 'pricing'], history: () => ['billing', 'pricing', 'x'] },
  usePricing: () => catalogueQuery(),
  usePricingHistory: (s: string | null) => historyQuery(s),
  useReprice: () => repriceMutation(),
}))

const { PricingPage } = await import('@/features/admin/PricingPage')
const { toCents } = await import('@/features/admin/RepriceForm')

const idle = { isError: false, isPending: false, isFetching: false, error: null, refetch: vi.fn() }

const rate = (oneTime: string, annual: string, monthly: string, daily: string) => ({
  one_time_cents: toCents(oneTime),
  annual_cents: toCents(annual),
  monthly_cents: toCents(monthly),
  daily_cents: toCents(daily),
  one_time: oneTime,
  annual,
  monthly,
  daily,
})

const tier = (stakeholder: string, label: string, unit: string, rates: ReturnType<typeof rate>) => ({
  id: stakeholder,
  stakeholder,
  label,
  unit,
  currency: 'USD',
  rates,
  effective_from: '2026-10-12',
  effective_to: null,
  is_current: true,
  notes: null,
})

const catalogue = {
  currency: 'USD',
  as_of: '2026-10-12',
  annual_total_cents: 60_300,
  annual_total: '603.00',
  tiers: [
    tier('cooperative', 'Cooperative', 'per cooperative', rate('2400.00', '600.00', '60.00', '1.60')),
    tier('development_agent', 'Development agent', 'per woreda', rate('9600.00', '2400.00', '240.00', '6.60')),
    tier('farmer_premium', 'Farmer (premium)', 'per farmer', rate('0.00', '3.00', '0.30', '0.01')),
  ],
}

const wrap = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <NextIntlClientProvider locale="en" messages={messages} timeZone="Africa/Addis_Ababa" formats={FORMATS}>
        <PricingPage />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  )

describe('toCents', () => {
  it('converts money without ever touching a float', () => {
    // 19.99 * 100 is 1998.9999999999998 in binary floating point; this must not be.
    expect(toCents('19.99')).toBe(1999)
    expect(toCents('0.30')).toBe(30)
    expect(toCents('1.6')).toBe(160)
    expect(toCents('600')).toBe(60_000)
    expect(toCents('0')).toBe(0)
  })
})

describe('PricingPage', () => {
  beforeEach(() => {
    catalogueQuery.mockReturnValue({ ...idle, data: catalogue })
    historyQuery.mockReturnValue({ ...idle, data: undefined })
    repriceMutation.mockReturnValue({ ...idle, mutate: vi.fn(), isPending: false })
  })

  it('shows every rate as sent, without dividing cents itself', () => {
    wrap()
    const row = screen.getByRole('row', { name: /Farmer \(premium\)/ })
    // $0.30 must render as 0.30, which is exactly the trap a cents-to-float division falls into.
    expect(within(row).getByText('0.30')).toBeInTheDocument()
    expect(within(row).getByText('3.00')).toBeInTheDocument()
  })

  it('shows what one subscription covers, because the unit is part of the price', () => {
    wrap()
    const row = screen.getByRole('row', { name: /Development agent/ })
    expect(within(row).getByText('per woreda')).toBeInTheDocument()
  })

  it('writes a free tier as a dash rather than a confident zero', () => {
    wrap()
    const row = screen.getByRole('row', { name: /Farmer \(premium\)/ })
    expect(within(row).getByText('—')).toBeInTheDocument()
  })

  it('states the annualised total of the whole card', () => {
    wrap()
    expect(screen.getByText(/totals 603\.00 a year/)).toBeInTheDocument()
  })

  it('opens a reprice form that supersedes rather than edits', () => {
    wrap()
    const row = screen.getByRole('row', { name: /Cooperative/ })
    fireEvent.click(within(row).getByRole('button', { name: /Reprice/ }))

    const form = screen.getByRole('form', { name: /Reprice Cooperative/ })
    expect(within(form).getByText(/supersedes the current price/)).toBeInTheDocument()
  })

  it('defaults a new price to start after the one in force', () => {
    wrap()
    const row = screen.getByRole('row', { name: /Cooperative/ })
    fireEvent.click(within(row).getByRole('button', { name: /Reprice/ }))

    // The API refuses a date that is not after the current rate's start, and on a fresh install
    // that start is today. Defaulting to today would hand the user a guaranteed 409.
    const from = screen.getByLabelText('Effective from') as HTMLInputElement
    expect(new Date(from.value).getTime()).toBeGreaterThan(Date.now())
  })

  it('submits money as integer cents', () => {
    const mutate = vi.fn()
    repriceMutation.mockReturnValue({ ...idle, mutate, isPending: false })
    wrap()
    const row = screen.getByRole('row', { name: /Cooperative/ })
    fireEvent.click(within(row).getByRole('button', { name: /Reprice/ }))

    fireEvent.submit(screen.getByRole('form', { name: /Reprice Cooperative/ }))
    expect(mutate).toHaveBeenCalled()
    const { change, stakeholder } = mutate.mock.calls[0]![0]
    expect(stakeholder).toBe('cooperative')
    expect(change.annual_cents).toBe(60_000)
    expect(change.daily_cents).toBe(160)
  })
})
