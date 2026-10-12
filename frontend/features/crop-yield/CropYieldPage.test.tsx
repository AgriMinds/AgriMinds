import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CropYieldCell, CropYieldModelCard, CropYieldOutlook } from '@agriminds/api-types'
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
vi.mock('@/features/crop-yield/useCropYield', () => ({
  cropYieldKeys: { outlook: () => ['crop-yield', 'outlook'], model: ['crop-yield', 'model'] },
  useCropYieldOutlook: (params?: { leadMonth?: number }) => outlookQuery(params),
  useCropYieldModel: () => modelQuery(),
}))

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

  it('reports an unavailable model instead of inventing yields', () => {
    const error = Object.assign(new Error('The crop-yield model is not available on this server.'), {
      status: 503,
      code: 'model_unavailable',
    })
    outlookQuery.mockReturnValue({ ...idle, isError: true, error })
    modelQuery.mockReturnValue({ ...idle, isError: true, error })
    wrap()
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0)
    expect(screen.queryByText('20.0')).not.toBeInTheDocument()
  })
})
