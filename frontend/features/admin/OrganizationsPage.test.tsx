import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { FORMATS } from '@/i18n/config'
import messages from '@/messages/en.json'

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
})

const orgsQuery = vi.fn()
const keysQuery = vi.fn()
const usageQuery = vi.fn()
vi.mock('@/features/admin/useOrganizations', () => ({
  orgKeys: { all: ['organizations'], keys: () => ['k'], usage: () => ['u'] },
  useOrganizations: () => orgsQuery(),
  useOrganizationKeys: () => keysQuery(),
  useOrganizationUsage: () => usageQuery(),
  useCreateOrganization: () => ({ mutate: vi.fn(), isPending: false, isError: false, error: null }),
  useIssueKey: () => ({ mutate: vi.fn(), isPending: false, isError: false, error: null }),
  useRevokeKey: () => ({ mutate: vi.fn(), isPending: false, isError: false, error: null }),
}))

const { OrganizationsPage } = await import('@/features/admin/OrganizationsPage')

const idle = { isError: false, isPending: false, isFetching: false, error: null, refetch: vi.fn() }

const bureau = {
  id: '11111111-2222-3333-4444-555555555555',
  name: 'Amhara Bureau of Agriculture',
  stakeholder: 'regional_government' as const,
  contact_email: null,
  woreda_id: null,
  is_active: true,
  created_at: '2026-10-13T06:00:00Z',
  api_quota_monthly: 250_000,
  api_requests_this_month: 3,
  active_keys: 1,
}

const wrap = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <NextIntlClientProvider locale="en" messages={messages} timeZone="Africa/Addis_Ababa" formats={FORMATS}>
        <OrganizationsPage />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  )

describe('OrganizationsPage', () => {
  beforeEach(() => {
    orgsQuery.mockReturnValue({ ...idle, data: [bureau] })
    keysQuery.mockReturnValue({ ...idle, data: [] })
    usageQuery.mockReturnValue({ ...idle, data: undefined })
  })

  it('never reports real usage as zero per cent', () => {
    // 3 of 250,000 rounds to 0%, which reads as "nothing has happened" and is false.
    wrap()
    const row = screen.getByRole('button', { name: /Amhara Bureau/ })
    expect(within(row).getByText('<1%')).toBeInTheDocument()
    expect(within(row).queryByText('0%')).not.toBeInTheDocument()
  })

  it('opens on an account rather than an empty panel', () => {
    // The right-hand panel used to say "select an account" even when there was only one.
    wrap()
    expect(screen.getByRole('button', { name: /Amhara Bureau/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByText(/Select an account to issue/)).not.toBeInTheDocument()
  })

  it('summarises the whole book at the top', () => {
    wrap()
    expect(screen.getByText('Paying accounts')).toBeInTheDocument()
    expect(screen.getByText('Active API keys')).toBeInTheDocument()
    expect(screen.getByText('Requests this month')).toBeInTheDocument()
  })

  it('keeps registering an account out of the way until it is wanted', () => {
    wrap()
    // The form competed with the list for attention; it is a disclosure now.
    expect(screen.queryByRole('form', { name: /Register an account/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Register an account/ })).toBeInTheDocument()
  })

  it('offers the action from the empty state, not just a description of the gap', () => {
    orgsQuery.mockReturnValue({ ...idle, data: [] })
    wrap()
    expect(screen.getByText('No paying accounts yet')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Register an account/ }).length).toBeGreaterThan(0)
  })
})
