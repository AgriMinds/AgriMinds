import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { describe, expect, it } from 'vitest'
import type { DroughtMapResponse } from '@agriminds/api-types'
import messages from '@/messages/en.json'
import { WatershedSummary } from '@/features/summary/WatershedSummary'

const base: DroughtMapResponse = {
  lead_month: 1,
  target_date: 'July 2026',
  issued_date: 'June 2026',
  grid_shape: [8, 8],
  bbox: [37.6, 10.4, 38.4, 11.2],
  mean_probability: 0.171,
  min_probability: 0.1,
  max_probability: 0.3,
  probabilities: [],
  cells: [],
  provenance: {
    model_version: 'superhybrid-0.1.0',
    data_source: 'synthetic',
    source: 'model',
    issued_date: '2026-06-01',
  },
}

const renderWith = (data: DroughtMapResponse) =>
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <WatershedSummary mapData={data} isLoading={false} selectedLead={1} />
    </NextIntlClientProvider>,
  )

describe('WatershedSummary', () => {
  it('shows the basin mean and a synthetic-data warning', () => {
    renderWith(base)
    expect(screen.getByText('17%')).toBeInTheDocument()
    const banner = screen.getByTestId('provenance-banner')
    expect(banner).toHaveTextContent('Demonstration forecast')
    expect(banner).toHaveTextContent('superhybrid-0.1.0')
  })

  it('hides the banner for a live model trained on real data', () => {
    renderWith({ ...base, provenance: { ...base.provenance, data_source: 'real' } })
    expect(screen.queryByTestId('provenance-banner')).not.toBeInTheDocument()
  })

  it('flags a precomputed raster even when data is real', () => {
    renderWith({ ...base, provenance: { ...base.provenance, data_source: 'real', source: 'precomputed' } })
    expect(screen.getByTestId('provenance-banner')).toHaveTextContent('Precomputed forecast')
  })
})
