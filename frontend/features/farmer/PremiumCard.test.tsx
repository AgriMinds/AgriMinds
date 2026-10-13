import { render, screen, fireEvent } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FORMATS } from '@/i18n/config'
import messages from '@/messages/en.json'

const myRequest = vi.fn()
const requestPremium = vi.fn()
vi.mock('@/features/farmer/useFarmer', () => ({
  useMyPremiumRequest: () => myRequest(),
  useRequestPremium: () => requestPremium(),
}))

const plansQuery = vi.fn()
const chooseMutation = vi.fn()
vi.mock('@/features/billing/usePlans', () => ({
  usePlans: () => plansQuery(),
  useChoosePlan: () => chooseMutation(),
}))

const { PremiumCard } = await import('@/features/farmer/PremiumCard')

const idle = { isError: false, isPending: false, isFetching: false, error: null, refetch: vi.fn() }
const mutation = { mutate: vi.fn(), isPending: false, isError: false, error: null, data: undefined }

const planSet = {
  stakeholder: 'farmer_premium' as const,
  label: 'Premium farmers',
  unit: 'per farmer',
  currency: 'ETB',
  strategy: null,
  value_note: null,
  api_quota_monthly: 0,
  pay_to: 'Commercial Bank of Ethiopia · AgriMinds · 1000XXXXXXXXX',
  outstanding: null,
  current: null,
  options: [
    {
      period: 'annual' as const,
      unit_price_cents: 46500,
      unit_price: '465.00',
      annualised_cents: 46500,
      annualised: '465.00',
      saving_vs_shortest_pct: 0,
    },
  ],
}

const bill = {
  id: 'i1',
  reference: 'AGM-2026-000007',
  organization_id: null,
  payer_name: 'Abebe Kebede',
  subscription_id: 's1',
  amount_cents: 46500,
  amount: '465.00',
  currency: 'ETB',
  description: 'Premium farmers — annual',
  issued_on: '2026-10-13',
  due_on: '2026-11-12',
  status: 'issued' as const,
  paid_on: null,
  method: null,
  payment_reference: null,
  overdue: false,
}

const wrap = () =>
  render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="Africa/Addis_Ababa" formats={FORMATS}>
      <PremiumCard />
    </NextIntlClientProvider>,
  )

describe('PremiumCard before approval', () => {
  beforeEach(() => {
    requestPremium.mockReturnValue({ ...mutation })
    plansQuery.mockReturnValue({ ...idle, data: planSet })
    chooseMutation.mockReturnValue({ ...mutation })
  })

  it('offers the request when nothing has been asked', () => {
    myRequest.mockReturnValue({ ...idle, data: null })
    wrap()
    expect(screen.getByRole('button', { name: /ask about premium/i })).toBeInTheDocument()
  })

  it('shows the request state instead of the offer once asked', () => {
    myRequest.mockReturnValue({ ...idle, data: { status: 'new' } })
    wrap()
    expect(screen.getByText(/we have your request/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /ask about premium/i })).not.toBeInTheDocument()
  })
})

describe('PremiumCard after approval', () => {
  beforeEach(() => {
    myRequest.mockReturnValue({ ...idle, data: { status: 'approved' } })
    requestPremium.mockReturnValue({ ...mutation })
    chooseMutation.mockReturnValue({ ...mutation })
    plansQuery.mockReturnValue({ ...idle, data: planSet })
  })

  it('offers the year at the price on the rate card, not one written into the page', () => {
    wrap()
    expect(screen.getByText('465.00 ETB a year')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /subscribe for a year/i })).toBeInTheDocument()
  })

  it('subscribes for exactly one farmer', () => {
    const mutate = vi.fn()
    chooseMutation.mockReturnValue({ ...mutation, mutate })
    wrap()
    fireEvent.click(screen.getByRole('button', { name: /subscribe for a year/i }))
    expect(mutate).toHaveBeenCalledWith({ period: 'annual', quantity: 1 })
  })

  it('shows the reference to quote once a bill exists', () => {
    chooseMutation.mockReturnValue({ ...mutation, data: { invoice: bill } })
    wrap()
    expect(screen.getByText('AGM-2026-000007')).toBeInTheDocument()
    expect(screen.getByText(/waiting for your payment of 465.00 ETB/i)).toBeInTheDocument()
    expect(screen.getByText(/Commercial Bank of Ethiopia/)).toBeInTheDocument()
  })

  it('still shows the reference after the page is reloaded', () => {
    // The reference was only ever on the checkout response, so closing the page lost the one
    // thing the farmer has to quote on a transfer.
    plansQuery.mockReturnValue({
      ...idle,
      data: { ...planSet, current: { status: 'pending_payment' }, outstanding: bill },
    })
    wrap()
    expect(screen.getByText('AGM-2026-000007')).toBeInTheDocument()
  })

  it('says how long premium runs for once it is active', () => {
    plansQuery.mockReturnValue({
      ...idle,
      data: { ...planSet, current: { status: 'active', ends_on: '2027-10-13' } },
    })
    wrap()
    expect(screen.getByText(/Premium is active until/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /subscribe/i })).not.toBeInTheDocument()
  })

  it('does not pretend to offer a plan it could not load', () => {
    plansQuery.mockReturnValue({ ...idle, isError: true, error: new Error('nope'), data: undefined })
    wrap()
    expect(screen.getByText(/nope/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /subscribe/i })).not.toBeInTheDocument()
  })
})
