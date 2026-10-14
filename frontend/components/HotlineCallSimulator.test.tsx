import { act, fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import messages from '@/messages/en.json'
import { HotlineCallSimulator } from '@/components/HotlineCallSimulator'

const speech = vi.fn()
vi.mock('@/features/farmer/useSpeech', () => ({ useSpeech: () => speech() }))

const mockSpeechState = {
  canSpeak: true,
  canListen: true,
  speaking: false,
  listening: false,
  speak: vi.fn(),
  stop: vi.fn(),
  listen: vi.fn(),
}

const wrap = (props = {}) =>
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <HotlineCallSimulator {...props} />
    </NextIntlClientProvider>,
  )

describe('HotlineCallSimulator', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    speech.mockReturnValue({ ...mockSpeechState })
  })

  it('renders the dialer with 977 and keypad buttons in idle state', () => {
    wrap()
    expect(screen.getByText('977')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Call 977/i })).toBeInTheDocument()
    expect(screen.getByText('ABC')).toBeInTheDocument()
    expect(screen.getByText('DEF')).toBeInTheDocument()
  })

  it('appends and deletes numbers in the dialer keypad', () => {
    wrap({ initialDialed: '97' })
    const button7 = screen.getByText('PQRS').closest('button')
    expect(button7).toBeInTheDocument()
    fireEvent.click(button7!)
    expect(screen.getByText('977')).toBeInTheDocument()

    const clearButton = screen.getByLabelText(/Clear/i)
    fireEvent.click(clearButton)
    expect(screen.getByText('97')).toBeInTheDocument()
  })

  it('initiates call, transitions from calling to connected, and presents AI greeting', () => {
    const speak = vi.fn()
    speech.mockReturnValue({ ...mockSpeechState, speak })
    wrap()

    const callButton = screen.getByRole('button', { name: /Call 977/i })
    fireEvent.click(callButton)

    // In calling state
    expect(screen.getAllByText(/Dialing 977/i).length).toBeGreaterThan(0)

    // Fast-forward past ring timer (1400ms)
    act(() => {
      vi.advanceTimersByTime(1500)
    })

    // Now connected
    expect(screen.getByText(/Connected · 977 Toll-Free IVR/i)).toBeInTheDocument()
    expect(
      screen.getByText(/Welcome to AgriMinds 977 toll-free agronomic hotline/i),
    ).toBeInTheDocument()
    expect(speak).toHaveBeenCalled()
  })

  it('handles IVR digit interaction between farmer and AI with voice output', () => {
    const speak = vi.fn()
    speech.mockReturnValue({ ...mockSpeechState, speak })
    wrap({ autoCall: true })

    act(() => {
      vi.advanceTimersByTime(1500)
    })

    expect(screen.getByText(/Connected · 977 Toll-Free IVR/i)).toBeInTheDocument()

    // Farmer taps topic "1 · Drought Risk"
    const riskChip = screen.getByRole('button', { name: /1 · Drought Risk/i })
    fireEvent.click(riskChip)

    // Farmer's turn appears
    expect(screen.getByText(/Pressed \[1\] · Drought Risk/i)).toBeInTheDocument()

    // AI's answer appears and is spoken aloud
    expect(
      screen.getByText(/Upper field \(Tef\): 11% chance of drought — Low/i),
    ).toBeInTheDocument()
    expect(speak).toHaveBeenCalledWith(
      expect.stringContaining('Upper field (Tef): 11% chance of drought'),
    )

    // Farmer taps topic "2 · When to Plant"
    const plantingChip = screen.getByRole('button', { name: /2 · When to Plant/i })
    fireEvent.click(plantingChip)

    expect(screen.getByText(/Pressed \[2\] · When to Plant/i)).toBeInTheDocument()
    expect(
      screen.getByText(/Plant at normal rain onset/i),
    ).toBeInTheDocument()
  })

  it('ends call cleanly and allows redialing', () => {
    const stop = vi.fn()
    speech.mockReturnValue({ ...mockSpeechState, stop })
    wrap({ autoCall: true })

    act(() => {
      vi.advanceTimersByTime(1500)
    })

    const endButton = screen.getByRole('button', { name: /End Call/i })
    fireEvent.click(endButton)

    expect(stop).toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: /Call Ended/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Call Again/i })).toBeInTheDocument()

    // Click Call Again
    const againButton = screen.getByRole('button', { name: /Call Again/i })
    fireEvent.click(againButton)
    expect(screen.getAllByText(/Dialing 977/i).length).toBeGreaterThan(0)
  })
})
