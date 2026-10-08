import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { describe, expect, it } from 'vitest'
import type { ObservedConditions as Conditions } from '@agriminds/api-types'
import messages from '@/messages/en.json'
import { ObservedConditions } from '@/features/conditions/ObservedConditions'

const conditions: Conditions = {
  index: 'scpdsi',
  as_of: 'June 2026',
  mean: 0.78,
  category: 'Normal',
  driest_category: 'Moderately dry',
  cells_in_drought: 3,
  classification_version: 'table2-2026.10',
  citation: 'Thresholds after Megbar & Tadesse (2016) and Menberu & Addisu (2018).',
  method_note: 'Self-calibrated Palmer index … it is not the NCAR scPDSI implementation.',
}

const wrap = (ui: React.ReactNode) =>
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  )

describe('ObservedConditions', () => {
  it('renders nothing when the server has no climate record', () => {
    const { container } = wrap(<ObservedConditions conditions={null} />)
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByTestId('observed-conditions')).not.toBeInTheDocument()
  })

  it('also renders nothing when the field is absent entirely', () => {
    const { container } = wrap(<ObservedConditions />)
    expect(container).toBeEmptyDOMElement()
  })

  it('reports the measured bands and the month they refer to', () => {
    wrap(<ObservedConditions conditions={conditions} />)
    expect(screen.getByTestId('observed-conditions')).toBeInTheDocument()
    expect(screen.getByText('Normal')).toBeInTheDocument()
    expect(screen.getByText('Moderately dry')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText(/Measured for June 2026/)).toBeInTheDocument()
  })

  it('shows the index as a signed value, never as a percentage', () => {
    wrap(<ObservedConditions conditions={conditions} />)
    expect(screen.getByText('+0.8')).toBeInTheDocument()
    expect(screen.queryByText(/%/)).not.toBeInTheDocument()
  })

  it('says in words that this is measured rather than forecast', () => {
    wrap(<ObservedConditions conditions={conditions} />)
    expect(screen.getByText(/this is not a forecast/i)).toBeInTheDocument()
    expect(screen.getByText(/how dry the ground already is/i)).toBeInTheDocument()
  })

  it('keeps the method caveat and the citation on the page', () => {
    wrap(<ObservedConditions conditions={conditions} />)
    expect(screen.getByText(/not the NCAR scPDSI implementation/)).toBeInTheDocument()
    expect(screen.getByText(/Megbar & Tadesse/)).toBeInTheDocument()
    expect(screen.getByText(/table2-2026\.10/)).toBeInTheDocument()
  })
})
