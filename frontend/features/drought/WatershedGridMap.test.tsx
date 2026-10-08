import { fireEvent, render, screen, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { describe, expect, it, vi } from 'vitest'
import type { DroughtMapResponse, GridCellRisk, WatershedBoundary } from '@agriminds/api-types'
import messages from '@/messages/en.json'
import { WatershedGridMap } from '@/features/drought/WatershedGridMap'

const cell = (
  row: number,
  col: number,
  probability: number,
  pdsi: number | null,
  band: GridCellRisk['pdsi_category'],
  in_watershed = true,
): GridCellRisk => ({
  row,
  col,
  latitude: 11 - row * 0.1,
  longitude: 37.6 + col * 0.1,
  probability,
  risk_level: probability < 0.25 ? 'Low' : probability < 0.45 ? 'Moderate' : 'High',
  pdsi,
  pdsi_category: band,
  in_watershed,
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

// The whole bounding box, so every projected corner is a round number and the path can be
// asserted exactly. area and cells_inside are what the real response carries for this basin.
const boundary: WatershedBoundary = {
  name: 'Choke Mountain Watershed',
  source: 'cmw_boundary.geojson',
  area_km2: 18948.4,
  bbox: [37.6, 10.4, 38.4, 11.2],
  grid: { rows: 2, cols: 2, cells_inside: 3, inside: [[true, true], [true, false]] },
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [37.6, 11.2],
        [38.4, 11.2],
        [38.4, 10.4],
        [37.6, 10.4],
        [37.6, 11.2],
      ],
    ],
  },
}

type Options = {
  onCellSelect?: ReturnType<typeof vi.fn>
  boundary?: WatershedBoundary
  selectedCell?: { row: number; col: number }
}

function wrap(mapData: DroughtMapResponse | undefined, options: Options | ReturnType<typeof vi.fn> = {}) {
  const opts: Options = typeof options === 'function' ? { onCellSelect: options } : options
  const onCellSelect = opts.onCellSelect ?? vi.fn()
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <WatershedGridMap
        mapData={mapData}
        boundary={opts.boundary}
        isLoading={false}
        isFetching={false}
        error={null}
        onRetry={() => {}}
        selectedLead={1}
        selectedCell={opts.selectedCell ?? { row: 1, col: 0 }}
        onCellSelect={onCellSelect}
      />
    </NextIntlClientProvider>,
  )
  return { onCellSelect }
}

/** A 3x3 patch with named cells outside the basin, for muting and skip-navigation. */
function masked(outside: string[]): DroughtMapResponse {
  return {
    ...map,
    grid_shape: [3, 3],
    cells: Array.from({ length: 3 }, (_, r) =>
      Array.from({ length: 3 }, (_, c) =>
        cell(r, c, 0.2 + r * 0.1 + c * 0.01, -1.2, 'Moderately dry', !outside.includes(`${r}-${c}`)),
      ),
    ).flat(),
  }
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

describe('WatershedGridMap catchment', () => {
  it('projects the outline into cell units so it lands on the grid', () => {
    wrap(map, { boundary })
    // The bbox corners are the cell-grid corners: 0,0 to cols,rows. Nothing is measured in
    // pixels, so this is the whole alignment contract in one assertion.
    const outline = screen.getByTestId('catchment-outline')
    expect(outline).toHaveAttribute('viewBox', '0 0 2 2')
    expect(outline).toHaveAttribute('preserveAspectRatio', 'none')
    expect(outline.querySelectorAll('path')[0]).toHaveAttribute(
      'd',
      'M0.000 0.000 L2.000 0.000 L2.000 2.000 L0.000 2.000 L0.000 0.000 Z',
    )
    expect(outline).toHaveAccessibleName('Surveyed outline of the Choke Mountain Watershed')
  })

  it('draws the plain grid when the deployment has no boundary', () => {
    wrap(map)
    expect(screen.queryByTestId('catchment-outline')).not.toBeInTheDocument()
    expect(screen.getAllByRole('gridcell')).toHaveLength(4)
    expect(screen.getByRole('gridcell', { name: /drought probability 12%/ })).toBeInTheDocument()
  })

  it('keeps the outline over the grid in the ground view too', () => {
    wrap(map, { boundary })
    fireEvent.click(screen.getByRole('radio', { name: 'Ground now' }))
    expect(screen.getByTestId('catchment-outline')).toBeInTheDocument()
  })

  it('mutes cells outside the basin, publishes no value for them and keeps them unselectable', () => {
    const { onCellSelect } = wrap(masked(['0-2']))
    const outsideCell = screen.getByRole('gridcell', { name: /Row 0, column 2, outside the watershed/ })

    expect(outsideCell.tagName).toBe('DIV')
    expect(outsideCell).toHaveAttribute('aria-disabled', 'true')
    expect(outsideCell).toHaveClass('outside-basin')
    expect(outsideCell).toHaveTextContent('')
    expect(screen.queryByText('22%')).not.toBeInTheDocument()

    fireEvent.click(outsideCell)
    expect(onCellSelect).not.toHaveBeenCalled()
  })

  it('mutes the same cells in the ground view, so dryness is not published outside the basin', () => {
    wrap(masked(['0-2']))
    fireEvent.click(screen.getByRole('radio', { name: 'Ground now' }))
    expect(screen.getByRole('gridcell', { name: /Row 0, column 2, outside the watershed/ })).toBeInTheDocument()
    // Nine cells, eight of them measured: the muted one shows no index value.
    expect(within(screen.getByRole('grid')).getAllByText('−1.2')).toHaveLength(8)
  })

  it('steps the arrow keys over cells outside the basin', () => {
    const { onCellSelect } = wrap(masked(['1-1']), { selectedCell: { row: 1, col: 0 } })
    fireEvent.keyDown(screen.getByRole('grid'), { key: 'ArrowRight' })
    expect(onCellSelect).toHaveBeenCalledWith({ row: 1, col: 2 })
  })

  it('stops at the edge of the basin rather than selecting ground outside it', () => {
    const { onCellSelect } = wrap(masked(['1-1', '1-2']), { selectedCell: { row: 1, col: 0 } })
    fireEvent.keyDown(screen.getByRole('grid'), { key: 'ArrowRight' })
    expect(onCellSelect).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Move right' })).toBeDisabled()
  })

  it('says why cells are blank: how many are in the basin, and how large it is', () => {
    wrap(map, { boundary })
    expect(screen.getByText(/4 of 4 cells lie inside the watershed/)).toBeInTheDocument()
    expect(screen.getByText(/catchment area 18,948 km²/)).toBeInTheDocument()
    expect(screen.getByText('Outside the watershed')).toBeInTheDocument()
  })

  it('reports the forecast box from the response, not a hardcoded one', () => {
    wrap({ ...map, bbox: [37.01, 9.84, 38.53, 11.26] })
    expect(screen.getByText('BBox: 37.01°E – 38.53°E, 9.84°N – 11.26°N')).toBeInTheDocument()
  })

  it('shows no reading when the selection lands outside the basin', () => {
    wrap(masked(['1-0']), { selectedCell: { row: 1, col: 0 } })
    expect(screen.queryByTestId('cell-inspector')).not.toBeInTheDocument()
    expect(screen.getByTestId('cell-outside')).toHaveTextContent('This cell lies outside the watershed')
  })
})
