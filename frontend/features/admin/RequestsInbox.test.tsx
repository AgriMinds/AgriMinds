import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FORMATS } from '@/i18n/config'
import messages from '@/messages/en.json'

const inboxQuery = vi.fn()
const decideMutation = vi.fn()
vi.mock('@/features/admin/useRequests', () => ({
  requestKeys: { inbox: () => ['access-requests', 'inbox'] },
  useAccessRequests: () => inboxQuery(),
  useDecideRequest: () => decideMutation(),
}))

const { RequestsInbox } = await import('@/features/admin/RequestsInbox')

const idle = { isError: false, isPending: false, isFetching: false, error: null, refetch: vi.fn() }

const enquiry = {
  id: 'r1',
  kind: 'organization' as const,
  status: 'new' as const,
  organization_name: 'Choke Farmers Union',
  contact_name: 'Almaz Bekele',
  contact_email: 'almaz@chokeunion.et',
  contact_phone: null,
  // The enquirer thinks they are a ministry. They are not.
  stakeholder: 'federal_ministry' as const,
  message: 'We represent 1,200 members.',
  created_at: '2026-10-13T06:00:00Z',
  decided_at: null,
  decision_note: null,
  organization_id: null,
}

const wrap = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <NextIntlClientProvider locale="en" messages={messages} timeZone="Africa/Addis_Ababa" formats={FORMATS}>
        <RequestsInbox />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  )

describe('RequestsInbox', () => {
  beforeEach(() => {
    inboxQuery.mockReturnValue({ ...idle, data: [enquiry] })
    decideMutation.mockReturnValue({ ...idle, mutate: vi.fn(), isPending: false })
  })

  it('shows who asked and how to reach them', () => {
    wrap()
    expect(screen.getByText('Choke Farmers Union')).toBeInTheDocument()
    expect(screen.getByText('almaz@chokeunion.et')).toBeInTheDocument()
  })

  it("shows the enquirer's own description without treating it as the decision", () => {
    wrap()
    // Marked as self-described, so an administrator reads it as a claim rather than a fact.
    expect(screen.getByText(/describes itself as/)).toBeInTheDocument()
  })

  it('makes the segment an explicit choice, because the price follows from it', () => {
    wrap()
    const select = screen.getByLabelText('Place in segment') as HTMLSelectElement
    // A farmer is not an organisation segment and must not be offered here.
    expect([...select.options].map((o) => o.value)).not.toContain('farmer_premium')
  })

  it('sends the chosen segment on approval, not the one that was claimed', () => {
    const mutate = vi.fn()
    decideMutation.mockReturnValue({ ...idle, mutate, isPending: false })
    wrap()

    fireEvent.change(screen.getByLabelText('Place in segment'), { target: { value: 'cooperative' } })
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }))

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'r1',
        decision: expect.objectContaining({ status: 'approved', stakeholder: 'cooperative' }),
      }),
    )
  })

  it('offers no decision controls on a request already decided', () => {
    inboxQuery.mockReturnValue({
      ...idle,
      data: [{ ...enquiry, status: 'approved' as const, decision_note: 'Signed for 2026' }],
    })
    wrap()
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument()
    expect(screen.getByText(/Signed for 2026/)).toBeInTheDocument()
  })

  it('says plainly when nothing is waiting', () => {
    inboxQuery.mockReturnValue({ ...idle, data: [] })
    wrap()
    expect(screen.getByText('Nothing waiting')).toBeInTheDocument()
  })
})
