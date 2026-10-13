import { render, screen, waitFor } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import messages from '@/messages/en.json'

const acceptInvitation = vi.fn()
class ApiError extends Error {}
vi.mock('@/lib/api/client', () => ({
  ApiError,
  authApi: { acceptInvitation: (...args: unknown[]) => acceptInvitation(...args) },
}))
vi.mock('@/components/layout/LanguageSwitcher', () => ({ LanguageSwitcher: () => null }))

const assign = vi.fn()
const { AcceptInvitationForm } = await import('@/features/auth/AcceptInvitationForm')

const wrap = (token = 'tok_abcdefghijklmnop') =>
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AcceptInvitationForm token={token} />
    </NextIntlClientProvider>,
  )

const type = (label: RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })

describe('AcceptInvitationForm', () => {
  beforeEach(() => {
    acceptInvitation.mockReset().mockResolvedValue({ role: 'agent' })
    assign.mockReset()
    Object.defineProperty(window, 'location', { value: { assign }, writable: true })
  })

  it('will not submit until the two entries match', () => {
    wrap()
    type(/new password/i, 'a-long-enough-passphrase')
    type(/repeat it/i, 'a-long-enough-passphrasX')
    expect(screen.getByText('Those two do not match.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /set password/i })).toBeDisabled()
  })

  it('will not submit a password the server would reject for length', () => {
    // Caught here only to save a round trip; the policy itself lives on the server.
    wrap()
    type(/new password/i, 'short')
    type(/repeat it/i, 'short')
    expect(screen.getByRole('button', { name: /set password/i })).toBeDisabled()
  })

  it('accepts the invitation and lands the person on their own home', async () => {
    wrap('tok_abcdefghijklmnop')
    type(/new password/i, 'a-long-enough-passphrase')
    type(/repeat it/i, 'a-long-enough-passphrase')
    fireEvent.click(screen.getByRole('button', { name: /set password/i }))

    await waitFor(() => expect(acceptInvitation).toHaveBeenCalledWith('tok_abcdefghijklmnop', 'a-long-enough-passphrase'))
    // An institutional customer belongs on the staff home, not the farmer page.
    await waitFor(() => expect(assign).toHaveBeenCalledWith('/ministry'))
  })

  it('reports a spent or expired invitation instead of looking like a dead button', async () => {
    acceptInvitation.mockRejectedValue(new ApiError('That invitation is no longer valid.'))
    wrap()
    type(/new password/i, 'a-long-enough-passphrase')
    type(/repeat it/i, 'a-long-enough-passphrase')
    fireEvent.click(screen.getByRole('button', { name: /set password/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('That invitation is no longer valid.')
    // And the form stays usable, so a mistyped password is not a dead end.
    expect(screen.getByRole('button', { name: /set password/i })).not.toBeDisabled()
  })
})
