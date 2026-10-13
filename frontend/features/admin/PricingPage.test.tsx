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

const tier = (
  stakeholder: string,
  label: string,
  unit: string,
  rates: ReturnType<typeof rate>,
  quota = 0,
) => ({
  id: stakeholder,
  stakeholder,
  label,
  unit,
  currency: 'ETB',
  rates,
  api_quota_monthly: quota,
  effective_from: '2026-10-12',
  effective_to: null,
  is_current: true,
  notes: null,
})

const catalogue = {
  currency: 'ETB',
  as_of: '2026-10-13',
  annual_total_cents: 456_015_000,
  annual_total: '4560150.00',
  tiers: [
    tier(
      'cooperative',
      'Cooperative',
      'per cooperative',
      rate('120000.00', '30000.00', '3000.00', '82.00'),
      10_000,
    ),
    tier(
      'development_agent',
      'Development agent',
      'per woreda',
      rate('480000.00', '120000.00', '12000.00', '330.00'),
      25_000,
    ),
    tier('farmer_premium', 'Farmer (premium)', 'per farmer', rate('0.00', '150.00', '15.00', '0.41'), 0),
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

  it('shows every rate as sent, without dividing santim itself', () => {
    wrap()
    const row = screen.getByRole('row', { name: /Farmer \(premium\)/ })
    // 0.41 birr a day must survive to the screen: it is exactly the value a santim-to-float
    // division mangles, and the server already sent it rendered.
    expect(within(row).getByText(/0\.41/)).toBeInTheDocument()
    expect(within(row).getByText(/150/)).toBeInTheDocument()
  })

  it('marks a tier that carries no API access rather than printing a bare zero', () => {
    wrap()
    const farmer = screen.getByRole('row', { name: /Farmer \(premium\)/ })
    expect(within(farmer).getByText('none')).toBeInTheDocument()
    const agent = screen.getByRole('row', { name: /Development agent/ })
    expect(within(agent).getByText('25K')).toBeInTheDocument()
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

  it('leads with what the whole card is worth, so nobody adds eight rows up by hand', () => {
    wrap()
    const tile = screen.getByText('One of each, per year').closest('div')?.parentElement
    expect(tile?.textContent).toMatch(/4\.6M|4,560,150/)
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

  it('submits money as integer santim, and carries the API quota with it', () => {
    const mutate = vi.fn()
    repriceMutation.mockReturnValue({ ...idle, mutate, isPending: false })
    wrap()
    const row = screen.getByRole('row', { name: /Cooperative/ })
    fireEvent.click(within(row).getByRole('button', { name: /Reprice/ }))

    fireEvent.submit(screen.getByRole('form', { name: /Reprice Cooperative/ }))
    expect(mutate).toHaveBeenCalled()
    const { change, stakeholder } = mutate.mock.calls[0]![0]
    expect(stakeholder).toBe('cooperative')
    expect(change.annual_cents).toBe(3_000_000)
    expect(change.daily_cents).toBe(8_200)
    // A price change is about money; it must not silently zero what the customer may call.
    expect(change.api_quota_monthly).toBe(10_000)
  })
})
