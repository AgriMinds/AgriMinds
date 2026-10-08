import { fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { describe, expect, it, vi } from 'vitest'
import type { DroughtMapResponse } from '@agriminds/api-types'
import messages from '@/messages/en.json'
import { ProvenanceBanner } from '@/features/summary/ProvenanceBanner'
import { WatershedSummary } from '@/features/summary/WatershedSummary'

const cell = (
  row: number,
  col: number,
  probability: number,
  risk_level: DroughtMapResponse['cells'][number]['risk_level'],
  in_watershed = true,
) => ({
  row,
  col,
  latitude: 11 - row * 0.1,
  longitude: 37.6 + col * 0.1,
  probability,
  risk_level,
  in_watershed,
})

const base: DroughtMapResponse = {
  lead_month: 1,
  target_date: 'July 2026',
  issued_date: 'June 2026',
  grid_shape: [2, 2],
  bbox: [37.6, 10.4, 38.4, 11.2],
  mean_probability: 0.171,
  min_probability: 0.1,
  max_probability: 0.7,
  probabilities: [
    [0.1, 0.2],
    [0.5, 0.7],
  ],
  cells: [cell(0, 0, 0.1, 'Low'), cell(0, 1, 0.2, 'Low'), cell(1, 0, 0.5, 'High'), cell(1, 1, 0.7, 'Severe')],
  provenance: { model_version: 'superhybrid-0.1.0', data_source: 'synthetic', source: 'model', issued_date: '2026-06-01' },
}

const wrap = (ui: React.ReactNode) => render(<NextIntlClientProvider locale="en" messages={messages}>{ui}</NextIntlClientProvider>)

describe('WatershedSummary', () => {
  it('shows basin mean, highest-risk cell and the count of cells at risk', () => {
    wrap(<WatershedSummary mapData={base} isLoading={false} selectedLead={1} />)
    expect(screen.getByText('17%')).toBeInTheDocument()
    expect(screen.getByText('70%')).toBeInTheDocument()
    expect(screen.getByText('of 4 grid cells')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('ignores cells outside the catchment in the counts and the highest-risk cell', () => {
    // The worst reading in the bounding box sits outside the basin, so it is not this
    // watershed's highest-risk cell and it must not be counted as one of its cells.
    const masked: DroughtMapResponse = {
      ...base,
      cells: [cell(0, 0, 0.1, 'Low'), cell(0, 1, 0.2, 'Low'), cell(1, 0, 0.5, 'High'), cell(1, 1, 0.7, 'Severe', false)],
    }
    wrap(<WatershedSummary mapData={masked} isLoading={false} selectedLead={1} />)
    expect(screen.getByText('of 3 grid cells')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()
    expect(screen.queryByText('70%')).not.toBeInTheDocument()
  })

  it('selects the highest-risk cell when its tile is clicked', () => {
    const onSelectCell = vi.fn()
    wrap(<WatershedSummary mapData={base} isLoading={false} selectedLead={1} onSelectCell={onSelectCell} />)
    fireEvent.click(screen.getByRole('button', { name: /highest-risk cell/i }))
    expect(onSelectCell).toHaveBeenCalledWith({ row: 1, col: 1 })
  })
})

describe('ProvenanceBanner', () => {
  it('warns about synthetic training data and shows the model version', () => {
    wrap(<ProvenanceBanner provenance={base.provenance} />)
    const banner = screen.getByTestId('provenance-banner')
    expect(banner).toHaveTextContent('Demonstration forecast')
    expect(banner).toHaveTextContent('superhybrid-0.1.0')
  })

  it('renders nothing for a live model trained on real data', () => {
    wrap(<ProvenanceBanner provenance={{ ...base.provenance, data_source: 'real' }} />)
    expect(screen.queryByTestId('provenance-banner')).not.toBeInTheDocument()
  })

  it('flags a precomputed raster even when data is real', () => {
    wrap(<ProvenanceBanner provenance={{ ...base.provenance, data_source: 'real', source: 'precomputed' }} />)
    expect(screen.getByTestId('provenance-banner')).toHaveTextContent('Precomputed forecast')
  })
})
