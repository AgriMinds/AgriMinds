import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FORMATS } from '@/i18n/config'
import messages from '@/messages/en.json'
import { ApiError } from '@/lib/api/client'

const plansQuery = vi.fn()
const invoicesQuery = vi.fn()
const chooseMutation = vi.fn()

vi.mock('@/features/billing/usePlans', () => ({
  planKeys: { plans: ['subscriptions', 'plans'], invoices: ['subscriptions', 'my-invoices'] },
  usePlans: () => plansQuery(),
  useMyInvoices: () => invoicesQuery(),
  useChoosePlan: () => ({ mutate: chooseMutation, isPending: false, isError: false, error: null }),
}))

const { PlansPage } = await import('@/features/billing/PlansPage')

const idle = { isError: false, isPending: false, isFetching: false, error: null, refetch: vi.fn() }

const samplePlanSet = {
  stakeholder: 'federal_ministry',
  label: 'Federal ministry',
  unit: 'per ministry',
  currency: 'ETB',
  strategy: 'National strategic license',
  value_note: 'Covers entire national ministry operations',
  api_quota_monthly: 1000000,
  options: [
    {
      period: 'annual',
      unit_price_cents: 450000000,
      unit_price: '4,500,000.00',
      annualised_cents: 450000000,
      annualised: '4,500,000.00',
      saving_vs_shortest_pct: 0.0,
    },
    {
      period: 'monthly',
      unit_price_cents: 45000000,
      unit_price: '450,000.00',
      annualised_cents: 540000000,
      annualised: '5,400,000.00',
      saving_vs_shortest_pct: 0.0,
    },
  ],
  current: null,
  pay_to: 'Commercial Bank of Ethiopia - 1000123456789',
  outstanding: null,
}

const wrap = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <NextIntlClientProvider locale="en" messages={messages} timeZone="Africa/Addis_Ababa" formats={FORMATS}>
        <PlansPage />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  )

describe('PlansPage', () => {
  beforeEach(() => {
    plansQuery.mockReturnValue({ ...idle, data: samplePlanSet })
    invoicesQuery.mockReturnValue({ ...idle, data: [] })
  })

  it('renders available plan options when data is loaded', () => {
    wrap()
    expect(screen.getByText('Federal ministry')).toBeInTheDocument()
    expect(screen.getByText('Plans & billing')).toBeInTheDocument()
    expect(screen.getByText('Annual')).toBeInTheDocument()
    expect(screen.getByText('Monthly')).toBeInTheDocument()
  })

  it('renders a friendly informative state when the account is not linked to an organisation (403)', () => {
    const error = new ApiError(
      403,
      'forbidden',
      'Your account is not linked to an organisation, so there is nothing to subscribe. Ask an administrator to connect you, or request access for your organisation.',
    )
    plansQuery.mockReturnValue({ ...idle, isError: true, error, data: undefined })

    wrap()
    expect(screen.getByText('Account not linked to an organisation')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Your account is not linked to an organisation, so there is nothing to subscribe. Ask an administrator to connect you, or request access for your organisation.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Request organisation access' })).toHaveAttribute(
      'href',
      '/request-access',
    )
    expect(screen.getByRole('link', { name: 'Back to overview' })).toHaveAttribute('href', '/')
    // Should NOT show the generic "Could not load data" heading
    expect(screen.queryByText('Could not load data')).not.toBeInTheDocument()
  })

  it('renders generic QueryError when a 500 or transport error occurs', () => {
    const error = new ApiError(500, 'server_error', 'Internal Server Error')
    plansQuery.mockReturnValue({ ...idle, isError: true, error, data: undefined })

    wrap()
    expect(screen.getByText('Could not load data')).toBeInTheDocument()
    expect(screen.getByText('Internal Server Error')).toBeInTheDocument()
  })
})
