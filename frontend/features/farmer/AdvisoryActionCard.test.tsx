import { fireEvent, render, screen, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { describe, expect, it, vi } from 'vitest'
import type { AdvisoryResponse } from '@agriminds/api-types'
import messages from '@/messages/en.json'
import { AdvisoryActionCard } from '@/features/farmer/AdvisoryActionCard'

const advisory: AdvisoryResponse = {
  crop: 'tef',
  lead_month: 1,
  row: 4,
  col: 4,
  target_date: 'July 2026',
  raw_probability: 0.11,
  adjusted_probability: 0.52,
  risk_level: 'High',
  season: 'Kiremt (Main Rainy Season / Meher)',
  enso_state: 'Neutral',
  enso_category: 'Neutral',
  crop_note: 'Short cycle',
  crop_recommendation: 'Use drought-tolerant tef seed.',
  planting_window: 'Stagger planting dates.',
  water_management: 'Schedule deficit irrigation.',
  preparedness_action: 'Secure fodder reserves.',
  iek_assessment: 'No traditional indicator submitted.',
  confidence_level: 'STANDARD (Model Driven)',
  rules_version: '2026.10-draft',
  provenance: {
    model_version: 'superhybrid-0.1.0',
    data_source: 'synthetic',
    source: 'model',
    issued_date: '2026-06-01',
  },
}

const wrap = (ui: React.ReactNode) =>
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  )

describe('AdvisoryActionCard', () => {
  it('leads with the risk level in words and the chance of drought', () => {
    wrap(<AdvisoryActionCard advisory={advisory} plotName="Upper field" />)
    expect(screen.getByRole('heading', { name: 'High' })).toBeInTheDocument()
    expect(screen.getByText('52%')).toBeInTheDocument()
    expect(screen.getByText(/Advice for Upper field/)).toBeInTheDocument()
  })

  it('shows all four actions the farmer can take', () => {
    wrap(<AdvisoryActionCard advisory={advisory} />)
    expect(screen.getByText('Use drought-tolerant tef seed.')).toBeInTheDocument()
    expect(screen.getByText('Stagger planting dates.')).toBeInTheDocument()
    expect(screen.getByText('Schedule deficit irrigation.')).toBeInTheDocument()
    expect(screen.getByText('Secure fodder reserves.')).toBeInTheDocument()
  })

  it('offers the acknowledge control once the API supplies a record to acknowledge', () => {
    wrap(<AdvisoryActionCard advisory={advisory} advisoryId="rec-1" onAcknowledge={vi.fn()} />)
    expect(screen.getByRole('button', { name: /I have read this/i })).toBeEnabled()
  })

  it('hides the control when there is no record id to post against', () => {
    wrap(<AdvisoryActionCard advisory={advisory} onAcknowledge={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /I have read this/i })).not.toBeInTheDocument()
  })

  it('acknowledges once and then stays disabled', () => {
    const onAcknowledge = vi.fn()
    const { rerender } = wrap(
      <AdvisoryActionCard advisory={advisory} advisoryId="rec-1" onAcknowledge={onAcknowledge} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /I have read this/i }))
    expect(onAcknowledge).toHaveBeenCalledTimes(1)

    rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <AdvisoryActionCard advisory={advisory} advisoryId="rec-1" acknowledged onAcknowledge={onAcknowledge} />
      </NextIntlClientProvider>,
    )
    expect(within(screen.getByTestId('advisory-action-card')).getByRole('status')).toHaveTextContent('Read')
    expect(screen.queryByRole('button', { name: /I have read this/i })).not.toBeInTheDocument()
    expect(onAcknowledge).toHaveBeenCalledTimes(1)
  })

  it('shows the acknowledged state on load when the server already recorded it', () => {
    wrap(<AdvisoryActionCard advisory={advisory} advisoryId="rec-1" acknowledged onAcknowledge={vi.fn()} />)
    expect(within(screen.getByTestId('advisory-action-card')).getByRole('status')).toHaveTextContent('Read')
    expect(screen.queryByRole('button', { name: /I have read this/i })).not.toBeInTheDocument()
  })

  it('disables the button while the acknowledgement is in flight', () => {
    wrap(
      <AdvisoryActionCard advisory={advisory} advisoryId="rec-1" acknowledging onAcknowledge={vi.fn()} />,
    )
    expect(screen.getByRole('button', { name: /I have read this/i })).toBeDisabled()
  })
})
