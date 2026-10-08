import { render, screen, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { beforeAll, describe, expect, it } from 'vitest'
import type { EnsoOutlookResponse } from '@agriminds/api-types'
import messages from '@/messages/en.json'
import { EnsoMonitor } from '@/features/enso/EnsoMonitor'

// Recharts measures its container; jsdom has no ResizeObserver.
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
})

const base: EnsoOutlookResponse = {
  current_nino34: -0.74,
  current_state: 'La Niña',
  current_category: 'Moderate La Niña',
  is_extreme: false,
  classification_version: 'table2-2026.10',
  citation: 'Thresholds after Megbar & Tadesse (2016) and Menberu & Addisu (2018).',
  forecast_horizon_months: 3,
  historical_series: [{ date: '2026-05', nino34: -0.6, is_forecast: false, category: 'Moderate La Niña' }],
  forecast_series: [
    { date: '2026-07', nino34: -0.74, is_forecast: true, category: 'Moderate La Niña' },
    { date: '2026-08', nino34: -1.2, is_forecast: true, category: 'High La Niña' },
  ],
  teleconnection_summary: 'La Niña is associated with enhanced moisture over the highlands.',
  provenance: {
    model_version: 'superhybrid-0.2.0',
    data_source: 'synthetic',
    source: 'model',
    issued_date: '2026-06-01',
  },
}

const wrap = (data: EnsoOutlookResponse) =>
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <EnsoMonitor data={data} isLoading={false} isFetching={false} error={null} onRetry={() => {}} />
    </NextIntlClientProvider>,
  )

describe('EnsoMonitor', () => {
  it('leads with the five-way band rather than the coarse phase', () => {
    wrap(base)
    expect(screen.getAllByText('Moderate La Niña').length).toBeGreaterThan(0)
    // The coarse phase stays visible so the finer band does not look like a rename.
    expect(screen.getByText('(La Niña)')).toBeInTheDocument()
  })

  it('does not flag an ordinary band as extreme', () => {
    wrap(base)
    expect(screen.queryByText('Extreme phase')).not.toBeInTheDocument()
  })

  it('flags a High band as extreme', () => {
    wrap({ ...base, current_nino34: -1.6, current_category: 'High La Niña', is_extreme: true })
    expect(screen.getByText('Extreme phase')).toBeInTheDocument()
    expect(screen.getAllByText('High La Niña').length).toBeGreaterThan(0)
  })

  it('labels the band edges of Table 2 on the gauge', () => {
    wrap(base)
    for (const edge of ['-1.0', '-0.5', '+0.5', '+1.0']) {
      expect(screen.getByText(edge)).toBeInTheDocument()
    }
  })

  it('names the band on each forecast tile, not just a phase', () => {
    wrap(base)
    const august = screen.getByText('2026-08').closest('div')!.parentElement!
    expect(within(august).getByText('High La Niña')).toBeInTheDocument()
  })

  it('credits the thresholds and records which classification produced them', () => {
    wrap(base)
    expect(screen.getByText(/Megbar & Tadesse/)).toBeInTheDocument()
    expect(screen.getByText(/table2-2026\.10/)).toBeInTheDocument()
  })
})
