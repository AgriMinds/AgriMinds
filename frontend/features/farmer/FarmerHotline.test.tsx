import { fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import messages from '@/messages/en.json'
import { FarmerHotline } from '@/features/farmer/FarmerHotline'

const speech = vi.fn()
vi.mock('@/features/farmer/useSpeech', () => ({ useSpeech: () => speech() }))

const mockSpeechState = {
  canSpeak: true,
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
      <FarmerHotline />
    </NextIntlClientProvider>,
  )

describe('FarmerHotline', () => {
  beforeEach(() => {
    speech.mockReturnValue({ ...mockSpeechState })
  })

  it('renders the 977 hotline title and description', () => {
    wrap()
    expect(screen.getByText('Hotline 977')).toBeInTheDocument()
    expect(
      screen.getByText('What farmers asked from a phone, and what went back'),
    ).toBeInTheDocument()
  })

  it('provides toll-free hotline dialog and call link to 977', () => {
    wrap()
    const callButton = screen.getByRole('button', { name: /Call 977 toll-free/i })
    fireEvent.click(callButton)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    const callLink = screen.getByRole('link', { name: /tel:977/i })
    expect(callLink).toHaveAttribute('href', 'tel:977')
  })

  it('renders phone inquiries from watershed woredas', () => {
    wrap()
    expect(screen.getAllByText(/Sinan/i).length).toBeGreaterThan(0)
    expect(
      screen.getByText(/What is the drought risk for my Tef plot in Sinan\?/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Upper field \(Tef\): 11% chance of drought — Low/i),
    ).toBeInTheDocument()
  })

  it('triggers voice readout when listen button is clicked', () => {
    const speak = vi.fn()
    speech.mockReturnValue({ ...mockSpeechState, speak })
    wrap()

    const listenButtons = screen.getAllByRole('button', { name: /Listen/i })
    expect(listenButtons.length).toBeGreaterThan(0)
    fireEvent.click(listenButtons[0]!)
    expect(speak).toHaveBeenCalled()
  })
})
