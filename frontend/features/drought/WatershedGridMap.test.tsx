import { fireEvent, render, screen, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { describe, expect, it, vi } from 'vitest'
import type { DroughtMapResponse, GridCellRisk } from '@agriminds/api-types'
import messages from '@/messages/en.json'
import { WatershedGridMap } from '@/features/drought/WatershedGridMap'

const cell = (
  row: number,
  col: number,
  probability: number,
  pdsi: number | null,
  band: GridCellRisk['pdsi_category'],
): GridCellRisk => ({
  row,
  col,
  latitude: 11 - row * 0.1,
  longitude: 37.6 + col * 0.1,
  probability,
  risk_level: probability < 0.25 ? 'Low' : probability < 0.45 ? 'Moderate' : 'High',
  pdsi,
  pdsi_category: band,
})

const map: DroughtMapResponse = {
  lead_month: 1,
  target_date: 'July 2026',
  issued_date: 'June 2026',
  grid_shape: [2, 2],
  bbox: [37.6, 10.4, 38.4, 11.2],
  mean_probability: 0.3,
  min_probability: 0.12,
  max_probability: 0.52,
  probabilities: [
    [0.12, 0.24],
    [0.38, 0.52],
  ],
  cells: [
    cell(0, 0, 0.12, -0.4, 'Normal'),
    cell(0, 1, 0.24, 1.8, 'Moderately wet'),
    cell(1, 0, 0.38, -2.3, 'Very dry'),
    cell(1, 1, 0.52, -3.6, 'Extremely dry'),
  ],
  conditions: {
    index: 'scpdsi',
    as_of: 'June 2026',
    mean: -1.1,
    category: 'Moderately dry',
    driest_category: 'Extremely dry',
    cells_in_drought: 2,
    classification_version: 'table2-2026.10',
    citation: 'Thresholds after Megbar & Tadesse (2016).',
    method_note: 'Not the NCAR scPDSI implementation.',
  },
  provenance: {
    model_version: 'superhybrid-0.2.0',
    data_source: 'synthetic',
    source: 'model',
    issued_date: '2026-06-01',
  },
}

function wrap(mapData: DroughtMapResponse | undefined, onCellSelect = vi.fn()) {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <WatershedGridMap
        mapData={mapData}
        isLoading={false}
        isFetching={false}
        error={null}
        onRetry={() => {}}
        selectedLead={1}
        selectedCell={{ row: 1, col: 0 }}
        onCellSelect={onCellSelect}
      />
    </NextIntlClientProvider>,
  )
  return { onCellSelect }
}

describe('WatershedGridMap modes', () => {
  it('offers the dryness view only when the server measured it', () => {
    wrap(map)
    expect(screen.getByRole('radiogroup', { name: 'What the grid shows' })).toBeInTheDocument()
  })

  it('hides the switch when there are no ground measurements', () => {
    wrap({ ...map, conditions: null, cells: map.cells.map((c) => ({ ...c, pdsi: null, pdsi_category: null })) })
    expect(screen.queryByRole('radiogroup', { name: 'What the grid shows' })).not.toBeInTheDocument()
    expect(screen.getByRole('grid', { name: 'Watershed drought risk grid' })).toBeInTheDocument()
  })

  it('shows forecast percentages first, and switches to signed index values', () => {
    wrap(map)
    const grid = () => screen.getByRole('grid')
    expect(within(grid()).getByText('12%')).toBeInTheDocument()
    expect(within(grid()).queryByText('−2.3')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: 'Ground now' }))

    expect(within(grid()).getByText('−2.3')).toBeInTheDocument()
    expect(within(grid()).queryByText('12%')).not.toBeInTheDocument()
  })

  it('retitles the card and relabels the grid when the mode changes', () => {
    wrap(map)
    expect(screen.getByRole('grid', { name: 'Watershed drought risk grid' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: 'Ground now' }))
    expect(screen.getByRole('grid', { name: 'Watershed ground conditions' })).toBeInTheDocument()
  })

  it('describes a cell by its own quantity in each mode', () => {
    wrap(map)
    expect(screen.getByRole('gridcell', { name: /Row 1, column 0, drought probability 38%/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: 'Ground now' }))
    expect(screen.getByRole('gridcell', { name: /Row 1, column 0, Sc-PDSI −2.3, Very dry/ })).toBeInTheDocument()
  })

  it('swaps the legend with the mode', () => {
    wrap(map)
    expect(screen.getByText('<25% (Low)')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: 'Ground now' }))
    expect(screen.queryByText('<25% (Low)')).not.toBeInTheDocument()
    expect(screen.getByText('Sc-PDSI, dry to wet')).toBeInTheDocument()
  })
})

describe('WatershedGridMap inspector', () => {
  it('shows the forecast and the ground state as separate, differently-labelled figures', () => {
    wrap(map)
    const inspector = screen.getByTestId('cell-inspector')
    const forecast = within(inspector).getByText('Chance of drought next season').closest('div')!
    expect(within(forecast).getByText('38.0%')).toBeInTheDocument()

    const ground = within(inspector).getByText('Ground now').closest('div')!
    expect(within(ground).getByText('−2.3')).toBeInTheDocument()
    expect(within(ground).getByText('Very dry')).toBeInTheDocument()

    // Different containers, different units: the two can never be read as one number.
    expect(forecast).not.toBe(ground)
    expect(within(ground).queryByText(/%/)).not.toBeInTheDocument()
    expect(within(forecast).queryByText('−2.3')).not.toBeInTheDocument()
  })

  it('keeps both figures visible in the dryness view', () => {
    wrap(map)
    fireEvent.click(screen.getByRole('radio', { name: 'Ground now' }))
    const inspector = screen.getByTestId('cell-inspector')
    expect(within(inspector).getByText('Chance of drought next season')).toBeInTheDocument()
    expect(within(inspector).getByText('Ground now')).toBeInTheDocument()
  })

  it('omits the ground figure when the cell has no measurement', () => {
    wrap({ ...map, conditions: null, cells: map.cells.map((c) => ({ ...c, pdsi: null, pdsi_category: null })) })
    const inspector = screen.getByTestId('cell-inspector')
    expect(within(inspector).getByText('Chance of drought next season')).toBeInTheDocument()
    expect(within(inspector).queryByText('Ground now')).not.toBeInTheDocument()
  })

  it('still moves the selection with the arrow keys in either mode', () => {
    const { onCellSelect } = wrap(map)
    fireEvent.click(screen.getByRole('radio', { name: 'Ground now' }))
    fireEvent.keyDown(screen.getByRole('grid'), { key: 'ArrowRight' })
    expect(onCellSelect).toHaveBeenCalledWith({ row: 1, col: 1 })
  })
})
