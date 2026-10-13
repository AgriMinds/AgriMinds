import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FORMATS } from '@/i18n/config'
import messages from '@/messages/en.json'

const revenueQuery = vi.fn()
const outstandingQuery = vi.fn()
vi.mock('@/features/billing/usePlans', () => ({
  planKeys: { revenue: ['subscriptions', 'revenue'], outstanding: ['admin', 'invoices'] },
  useRevenue: () => revenueQuery(),
  useOutstandingInvoices: () => outstandingQuery(),
  useConfirmPayment: () => ({ mutate: vi.fn(), isPending: false, isError: false, error: null }),
}))

const { AdminBillingPage } = await import('@/features/billing/AdminBillingPage')

const idle = { isError: false, isPending: false, isFetching: false, error: null, refetch: vi.fn() }

const summary = {
  as_of: '2026-10-13',
  currency: 'ETB',
  active_subscriptions: 3,
  arr_cents: 242400000,
  arr: '2424000.00',
  mrr_cents: 20200000,
  mrr: '202000.00',
  perpetual_cents: 0,
  perpetual: '0.00',
  by_stakeholder: [
    {
      stakeholder: 'regional_government',
      label: 'Regional Government',
      subscriptions: 1,
      annualised_cents: 180000000,
      annualised: '1800000.00',
    },
    {
      stakeholder: 'cooperative',
      label: 'Cooperative',
      subscriptions: 1,
      annualised_cents: 2400000,
      annualised: '24000.00',
    },
  ],
  renewals_due: [],
  lapsed: [],
}

const wrap = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <NextIntlClientProvider locale="en" messages={messages} timeZone="Africa/Addis_Ababa" formats={FORMATS}>
        <AdminBillingPage />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  )

describe('AdminBillingPage', () => {
  beforeEach(() => {
    revenueQuery.mockReturnValue({ ...idle, data: summary })
    outstandingQuery.mockReturnValue({ ...idle, data: [] })
  })

  it('leads with what has actually been earned', () => {
    wrap()
    expect(screen.getByText('Annual recurring')).toBeInTheDocument()
    // Only settled invoices are in here, which is the whole point of the subtitle.
    expect(screen.getByText(/Unpaid plans excluded/)).toBeInTheDocument()
  })

  it('breaks the revenue down by segment', () => {
    wrap()
    expect(screen.getByText('Regional Government')).toBeInTheDocument()
    expect(screen.getByText('Cooperative')).toBeInTheDocument()
  })

  it('shows the payments waiting on a human, since nothing else will start them', () => {
    wrap()
    expect(screen.getByText(/outstanding/i)).toBeInTheDocument()
  })

  it('says the lists are empty rather than rendering nothing', () => {
    wrap()
    expect(screen.getByText('Nothing due in the next 60 days.')).toBeInTheDocument()
    expect(screen.getByText('Nothing has lapsed.')).toBeInTheDocument()
  })

  it('names the accounts that need chasing', () => {
    revenueQuery.mockReturnValue({
      ...idle,
      data: {
        ...summary,
        renewals_due: [
          { organization_name: 'Amhara Bureau', ends_on: '2026-11-30', annualised: '1800000.00' },
        ],
        lapsed: [{ organization_name: 'DMU', ends_on: '2026-09-30', annualised: '45000.00' }],
      },
    })
    wrap()
    expect(screen.getByText('Amhara Bureau')).toBeInTheDocument()
    // Lapsed is revenue that has already stopped, so it is listed apart from the renewals.
    expect(screen.getByText('DMU')).toBeInTheDocument()
  })

  it('reports a failure instead of showing zero earnings', () => {
    // A blank dashboard and a broken one must not look the same.
    revenueQuery.mockReturnValue({ ...idle, isError: true, error: new Error('nope'), data: undefined })
    wrap()
    expect(screen.getByText(/nope/)).toBeInTheDocument()
    expect(screen.queryByText('Annual recurring')).not.toBeInTheDocument()
  })
})
