import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  CropYieldCell,
  CropYieldModelCard,
  CropYieldOutlook,
  EnsoImpactResponse,
  EnsoOutlookResponse,
} from '@agriminds/api-types'
import { FORMATS } from '@/i18n/config'
import messages from '@/messages/en.json'

// Recharts measures its container; jsdom has no ResizeObserver.
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
})

const outlookQuery = vi.fn()
const modelQuery = vi.fn()
const impactQuery = vi.fn()
const ensoQuery = vi.fn()
vi.mock('@/features/crop-yield/useCropYield', () => ({
  cropYieldKeys: {
    outlook: () => ['crop-yield', 'outlook'],
    model: ['crop-yield', 'model'],
    impact: ['crop-yield', 'enso-impact'],
  },
  useCropYieldOutlook: (params?: { leadMonth?: number }) => outlookQuery(params),
  useCropYieldModel: () => modelQuery(),
  useEnsoImpact: () => impactQuery(),
}))
vi.mock('@/features/enso/useEnsoOutlook', () => ({ useEnsoOutlook: () => ensoQuery() }))

const { CropYieldPage } = await import('@/features/crop-yield/CropYieldPage')

const cell = (over: Partial<CropYieldCell> = {}): CropYieldCell => ({
  crop: 'tef',
  zone: 'Lowland',
  zone_local_name: 'Kolla',
  altitude_approx_m: 1000,
  predicted_yield_q_ha: 18.54,
  neutral_yield_q_ha: 18.64,
  enso_delta_pct: -0.56,
  last_observed_yield_q_ha: 13.21,
  change_vs_last_observed_pct: 40.37,
  inputs: {
    year: 2024,
    temperature_c: 18.2,
    precipitation_mm: 110.1,
    enso_index: 0.6,
    enso_phase: 'El Nino',
    yield_lag1: 13.21,
    yield_rolling3_mean: 12.4,
  },
  ...over,
})

const CROPS = ['tef', 'wheat', 'maize'] as const
const ZONES = ['Lowland', 'Midland', 'Highland'] as const
const LOCAL = { Lowland: 'Kolla', Midland: 'Woina Dega', Highland: 'Dega' }

const outlook: CropYieldOutlook = {
  year: 2024,
  enso_index: 0.6,
  enso_phase: 'El Nino',
  enso_basis: 'observed',
  lead_month: null,
  baseline_year: 2023,
  cells: CROPS.flatMap((crop, i) =>
    ZONES.map((zone, j) =>
      cell({
        crop,
        zone,
        zone_local_name: LOCAL[zone],
        predicted_yield_q_ha: 20 + i * 10 + j,
        neutral_yield_q_ha: 20 + i * 10 + j - (j - 1) * 0.5,
        enso_delta_pct: (j - 1) * 2.5,
      }),
    ),
  ),
  caveats: ['The lag features carry 56% of the model’s gain.', 'Holdout RMSE is 7.06 q/ha.'],
  provenance: {
    model_name: 'XGBoost',
    model_version: 'crop-yield-0.1.0',
    trained_at: '2026-10-12T09:22:56+00:00',
    dataset_file: 'climate-crop-v2.xlsx',
    record_years: [1990, 2023],
    test_rmse_q_ha: 7.056,
    test_r2: 0.784,
  },
}

const card: CropYieldModelCard = {
  provenance: outlook.provenance,
  upstream_repo: 'aykgeh/Chokye_Water_Shield',
  upstream_revision: 'd0584f7',
  record_rows: 306,
  train_years: [1990, 2016],
  test_years: [2017, 2023],
  test_rows: 63,
  mean_yield_q_ha: 27.65,
  candidates: [
    { model: 'XGBoost', train_rmse: 0.72, test_rmse: 7.06, test_mae: 5.51, test_r2: 0.784, test_mape: 23.2, selected: true },
    { model: 'Random Forest', train_rmse: 1.99, test_rmse: 7.13, test_mae: 5.55, test_r2: 0.78, test_mape: 22.1, selected: false },
  ],
  feature_importance: [
    { feature: 'yield_lag1', importance: 0.5317 },
    { feature: 'enso_index', importance: 0.013 },
  ],
  zones: [
    { zone: 'Lowland', local_name: 'Kolla', altitude_approx_m: 1000, altitude_min_m: 500, altitude_max_m: 1500 },
    { zone: 'Midland', local_name: 'Woina Dega', altitude_approx_m: 2000, altitude_min_m: 1500, altitude_max_m: 2500 },
    { zone: 'Highland', local_name: 'Dega', altitude_approx_m: 2800, altitude_min_m: 2500, altitude_max_m: 3500 },
  ],
  caveats: outlook.caveats,
}

/** Nothing significant on eight El Niño years — the real shape of this table. */
const impact: EnsoImpactResponse = {
  cells: [
    { crop: 'maize', zone: 'Highland', effect_pct: -0.22, p_value: 0.9817, significant: false, n_el_nino: 8, n_other: 26 },
    { crop: 'maize', zone: 'Lowland', effect_pct: -2.0, p_value: 0.78, significant: false, n_el_nino: 8, n_other: 26 },
    { crop: 'maize', zone: 'Midland', effect_pct: 2.35, p_value: 0.7186, significant: false, n_el_nino: 8, n_other: 26 },
    { crop: 'tef', zone: 'Highland', effect_pct: -2.03, p_value: 0.7704, significant: false, n_el_nino: 8, n_other: 26 },
    { crop: 'tef', zone: 'Lowland', effect_pct: -8.52, p_value: 0.2684, significant: false, n_el_nino: 8, n_other: 26 },
    { crop: 'tef', zone: 'Midland', effect_pct: -4.25, p_value: 0.0634, significant: false, n_el_nino: 8, n_other: 26 },
    { crop: 'wheat', zone: 'Highland', effect_pct: -6.64, p_value: 0.2806, significant: false, n_el_nino: 8, n_other: 26 },
    { crop: 'wheat', zone: 'Lowland', effect_pct: -11.57, p_value: 0.135, significant: false, n_el_nino: 8, n_other: 26 },
    { crop: 'wheat', zone: 'Midland', effect_pct: -7.65, p_value: 0.5132, significant: false, n_el_nino: 8, n_other: 26 },
  ],
  by_crop: [
    { key: 'maize', effect_pct: 0.04, significant_cells: 0 },
    { key: 'tef', effect_pct: -4.93, significant_cells: 0 },
    { key: 'wheat', effect_pct: -8.62, significant_cells: 0 },
  ],
  by_zone: [
    { key: 'Highland', effect_pct: -2.96, significant_cells: 0 },
    { key: 'Lowland', effect_pct: -7.36, significant_cells: 0 },
    { key: 'Midland', effect_pct: -3.18, significant_cells: 0 },
  ],
  overall_effect_pct: -4.5,
  significant_cells: 0,
  el_nino_years: [1991, 1992, 1997, 2002, 2015, 2016, 2019, 2023],
  record_years: [1990, 2023],
  method: 'Each crop-zone series is detrended first, then Welch\u2019s t-test compares the groups.',
  recommendations: [
    { crop: 'maize', zone: 'Lowland', zone_local_name: 'Kolla', effect_pct: -2.0, p_value: 0.78, significant: false, still_negative: true },
    { crop: 'maize', zone: 'Midland', zone_local_name: 'Woina Dega', effect_pct: 2.35, p_value: 0.7186, significant: false, still_negative: false },
    { crop: 'maize', zone: 'Highland', zone_local_name: 'Dega', effect_pct: -0.22, p_value: 0.9817, significant: false, still_negative: true },
  ],
  cautions: [
    { crop: 'wheat', zone: 'Lowland', zone_local_name: 'Kolla', effect_pct: -11.57, p_value: 0.135, significant: false, still_negative: true },
    { crop: 'tef', zone: 'Lowland', zone_local_name: 'Kolla', effect_pct: -8.52, p_value: 0.2684, significant: false, still_negative: true },
  ],
}

const ensoOutlook = {
  current_nino34: 1.58,
  current_state: 'El Niño',
  current_category: 'High El Niño',
  is_extreme: true,
} as unknown as EnsoOutlookResponse

const idle = { data: undefined, isError: false, error: null, isFetching: false, refetch: vi.fn() }

const wrap = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <NextIntlClientProvider locale="en" messages={messages} timeZone="Africa/Addis_Ababa" formats={FORMATS}>
        <CropYieldPage />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  )

describe('CropYieldPage', () => {
  beforeEach(() => {
    outlookQuery.mockReturnValue({ ...idle, data: outlook })
    modelQuery.mockReturnValue({ ...idle, data: card })
    impactQuery.mockReturnValue({ ...idle, data: impact })
    ensoQuery.mockReturnValue({ ...idle, data: ensoOutlook })
  })

  it('shows a prediction for every crop and belt', () => {
    wrap()
    for (const c of outlook.cells) {
      expect(screen.getAllByText(c.predicted_yield_q_ha.toFixed(1)).length).toBeGreaterThan(0)
    }
  })

  it('names the belts by their local and English names with the altitudes from the model card', () => {
    wrap()
    expect(screen.getAllByText('Kolla').length).toBeGreaterThan(0)
    expect(screen.getByText('Lowland · 500–1500 m')).toBeInTheDocument()
    expect(screen.getByText('Highland · 2500–3500 m')).toBeInTheDocument()
  })

  it('says which Niño 3.4 value the numbers were conditioned on', () => {
    wrap()
    expect(screen.getByText(/Conditioned on Niño 3\.4 \+0\.60 \(El Nino\)/)).toBeInTheDocument()
    expect(screen.getByText(/last observed month/)).toBeInTheDocument()
  })

  it('credits the forecast when a lead is chosen, and asks for that lead', () => {
    outlookQuery.mockImplementation((params?: { leadMonth?: number }) => ({
      ...idle,
      data: params?.leadMonth
        ? { ...outlook, enso_basis: 'forecast' as const, lead_month: params.leadMonth }
        : outlook,
    }))
    wrap()
    fireEvent.click(screen.getByRole('radio', { name: /Forecast \+3 mo/ }))
    expect(outlookQuery).toHaveBeenLastCalledWith({ leadMonth: 3 })
    expect(screen.getByText(/CNN-LSTM forecast, lead 3 months/)).toBeInTheDocument()
  })

  it('compares against the last observed year, not the year being predicted', () => {
    wrap()
    // The record ends in 2023 while the prediction is for 2024: the comparison is to 2023.
    expect(screen.getAllByText('2023 observed').length).toBe(outlook.cells.length)
    expect(screen.queryByText('2024 observed')).not.toBeInTheDocument()
  })

  it("renders the artifact's own caveats rather than a paraphrase", () => {
    wrap()
    for (const caveat of card.caveats) {
      expect(screen.getAllByText(caveat).length).toBeGreaterThan(0)
    }
  })

  it('marks which candidate is actually serving predictions', () => {
    wrap()
    const row = screen.getByRole('row', { name: /XGBoost/ })
    expect(within(row).getByText('In use')).toBeInTheDocument()
  })

  it('shows what the model leans on, so a 53% lag feature cannot be mistaken for climate skill', () => {
    wrap()
    expect(screen.getByText('yield_lag1')).toBeInTheDocument()
    expect(screen.getByText('53.2%')).toBeInTheDocument()
    expect(screen.getByText('1.3%')).toBeInTheDocument()
  })

  it('offers the ENSO chart as a table as well', () => {
    wrap()
    expect(screen.getByText('Read as a table')).toBeInTheDocument()
  })

  it('puts the live Niño 3.4 reading and its phase at the top', () => {
    wrap()
    expect(screen.getByText('+1.58 °C')).toBeInTheDocument()
    expect(screen.getByText(/Currently in the High El Niño band/)).toBeInTheDocument()
  })

  it('prints a p-value beside every measured effect', () => {
    wrap()
    // The matrix is rendered twice — stacked cards below `sm`, a table above it — and jsdom
    // applies no media queries, so both copies are in the document here.
    expect(screen.getAllByText('-11.57%').length).toBeGreaterThan(0)
    expect(screen.getAllByText('p = 0.135').length).toBeGreaterThan(0)
    expect(screen.getAllByText('+2.35%').length).toBeGreaterThan(0)
  })

  it('says plainly that nothing in the matrix reaches significance', () => {
    wrap()
    expect(
      screen.getByText(/0 of 9 cells reach p < 0.05 — the record shows a direction/),
    ).toBeInTheDocument()
  })

  it('calls the best crop in a losing belt a smallest loss, not a gain', () => {
    wrap()
    expect(screen.getByText('Smallest loss: 2.00% below trend')).toBeInTheDocument()
    expect(screen.getByText('+2.35% above trend in El Niño years')).toBeInTheDocument()
  })

  it('derives the caution from the worst pairing in the record, with its number', () => {
    wrap()
    expect(
      screen.getByText(/the worst pairing in the record, 11.57% below trend in El Niño years/),
    ).toBeInTheDocument()
  })

  it('marks which recommended actions came from this record', () => {
    wrap()
    expect(screen.getAllByText('From this record').length).toBe(2)
    expect(screen.getByText('Favour Maize in the Midland belt.')).toBeInTheDocument()
  })

  it('reports an unavailable model instead of inventing yields', () => {
    const error = Object.assign(new Error('The crop-yield model is not available on this server.'), {
      status: 503,
      code: 'model_unavailable',
    })
    outlookQuery.mockReturnValue({ ...idle, isError: true, error })
    modelQuery.mockReturnValue({ ...idle, isError: true, error })
    impactQuery.mockReturnValue({ ...idle, isError: true, error })
    wrap()
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0)
    expect(screen.queryByText('20.0')).not.toBeInTheDocument()
  })
})
