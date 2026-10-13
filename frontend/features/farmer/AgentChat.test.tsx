import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import messages from '@/messages/en.json'

const askMutation = vi.fn()
vi.mock('@/features/farmer/useAgent', () => ({ useAskAgent: () => askMutation() }))

const dashboardQuery = vi.fn()
vi.mock('@/features/farmer/useFarmer', () => ({ useFarmerDashboard: () => dashboardQuery() }))

const speech = vi.fn()
vi.mock('@/features/farmer/useSpeech', () => ({ useSpeech: () => speech() }))

const { AgentChat } = await import('@/features/farmer/AgentChat')

const noSpeech = {
  canSpeak: false,
  canListen: false,
  speaking: false,
  listening: false,
  speak: vi.fn(),
  stop: vi.fn(),
  listen: vi.fn(),
}

const wrap = () =>
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AgentChat />
    </NextIntlClientProvider>,
  )

describe('AgentChat', () => {
  beforeEach(() => {
    askMutation.mockReturnValue({ mutate: vi.fn(), isPending: false })
    dashboardQuery.mockReturnValue({ data: { hotline: { short_code: '977', connected: false } } })
    speech.mockReturnValue({ ...noSpeech })
  })

  it('offers the questions as taps so nobody has to guess the wording', () => {
    wrap()
    for (const label of ['Drought risk', 'When to plant', 'Water', 'Which seed', 'My plots', 'The season']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
  })

  it('sends the same digit the hotline menu uses, so the two agree', () => {
    const mutate = vi.fn()
    askMutation.mockReturnValue({ mutate, isPending: false })
    wrap()
    fireEvent.click(screen.getByRole('button', { name: 'Water' }))
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ text: '3', locale: 'en' }),
      expect.anything(),
    )
  })

  it('shows the question and then the answer', async () => {
    const mutate = vi.fn((_vars, opts) => opts.onSuccess({ text: 'Plant in early July.', intent: 'planting' }))
    askMutation.mockReturnValue({ mutate, isPending: false })
    wrap()
    fireEvent.change(screen.getByLabelText('Your question'), { target: { value: 'when do i plant' } })
    fireEvent.submit(screen.getByLabelText('Your question').closest('form')!)

    expect(await screen.findByText('when do i plant')).toBeInTheDocument()
    expect(await screen.findByText('Plant in early July.')).toBeInTheDocument()
  })

  it('shows a failure as a reply rather than losing the question', async () => {
    const mutate = vi.fn((_vars, opts) => opts.onError(new Error('The forecast is unavailable.')))
    askMutation.mockReturnValue({ mutate, isPending: false })
    wrap()
    fireEvent.click(screen.getByRole('button', { name: 'Drought risk' }))
    expect(await screen.findByText('The forecast is unavailable.')).toBeInTheDocument()
  })

  it('will not send an empty question', () => {
    const mutate = vi.fn()
    askMutation.mockReturnValue({ mutate, isPending: false })
    wrap()
    fireEvent.submit(screen.getByLabelText('Your question').closest('form')!)
    expect(mutate).not.toHaveBeenCalled()
  })

  it('hides voice when the browser has none for this language', () => {
    // An Amharic answer read in an English voice is noise, and a mic that mishears every word is
    // worse than no mic.
    wrap()
    expect(screen.queryByRole('button', { name: 'Speak your question' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Read aloud' })).not.toBeInTheDocument()
  })

  it('offers to read the answer aloud when a matching voice exists', async () => {
    const speak = vi.fn()
    speech.mockReturnValue({ ...noSpeech, canSpeak: true, speak })
    const mutate = vi.fn((_vars, opts) => opts.onSuccess({ text: 'Low risk.', intent: 'risk' }))
    askMutation.mockReturnValue({ mutate, isPending: false })
    wrap()
    fireEvent.click(screen.getByRole('button', { name: 'Drought risk' }))

    const button = await screen.findByRole('button', { name: 'Read aloud' })
    fireEvent.click(button)
    await waitFor(() => expect(speak).toHaveBeenCalledWith('Low risk.'))
  })

  it('says the hotline is not connected yet rather than printing a dead number', () => {
    wrap()
    expect(screen.getByText(/977 free from any phone/)).toBeInTheDocument()
    expect(screen.getByText(/needs an Ethio Telecom short code/)).toBeInTheDocument()
  })

  it('drops the caveat once a carrier is connected', () => {
    dashboardQuery.mockReturnValue({ data: { hotline: { short_code: '977', connected: true } } })
    wrap()
    expect(screen.queryByText(/needs an Ethio Telecom short code/)).not.toBeInTheDocument()
    expect(screen.getByText(/977 free from any phone/)).toBeInTheDocument()
  })
})
