import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { HorizonResponse } from '@agriminds/api-types'
import { FORMATS } from '@/i18n/config'
import messages from '@/messages/en.json'

const horizon = vi.fn<() => Promise<HorizonResponse>>()
vi.mock('@/lib/api/client', () => ({
  api: {
    get horizon() {
      return horizon
    },
  },
  ApiError: class ApiError extends Error {
    status = 500
  },
}))

const { PredictionHorizon } = await import('@/features/prediction/PredictionHorizon')

const skill = (bss: number, auc: number) => ({
  auc,
  auc_persistence: 0.5,
  brier: 0.12,
  bss_vs_climatology: bss,
  pod: 0.8,
  far: 0.77,
})

const response: HorizonResponse = {
  issued_date: '2026-06-01',
  trained_leads: 3,
  skilful_leads: [1],
  min_skilful_bss: 0.02,
  teleconnection_r: -0.193,
  note: '1 of 3 leads beat climatology and carry a probability.',
  leads: [
    {
      lead_month: 1,
      target_month: '2026-07-01',
      kind: 'forecast',
      skill: skill(0.058, 0.714),
      probability: 0.208,
      max_probability: 0.31,
      cells_at_risk: 10,
      enso_anomaly: 1.4,
    },
    {
      lead_month: 2,
      target_month: '2026-08-01',
      kind: 'outlook',
      skill: skill(0.011, 0.595),
      direction: 'drier',
      confidence: 'moderate',
      basis: 'High El Niño is expected and leans the season drier than normal.',
      enso_anomaly: 1.6,
      enso_category: 'High El Niño',
    },
    {
      lead_month: 3,
      target_month: '2026-09-01',
      kind: 'outlook',
      skill: skill(-0.021, 0.492),
      direction: 'near normal',
      confidence: 'low',
      basis: 'ENSO tracks drought here too weakly to lean on.',
      enso_anomaly: 0.2,
      enso_category: 'Neutral',
    },
  ],
}

const wrap = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <NextIntlClientProvider locale="en" messages={messages} timeZone="Africa/Addis_Ababa" formats={FORMATS}>
        <PredictionHorizon locale="en" />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  )

describe('PredictionHorizon', () => {
  beforeEach(() => {
    horizon.mockReset()
    horizon.mockResolvedValue(response)
  })

  it('shows every month the model was trained for', async () => {
    wrap()
    expect(await screen.findAllByRole('listitem')).toHaveLength(3)
  })

  it('gives a probability only to the lead that earned one', async () => {
    wrap()
    const rows = await screen.findAllByRole('listitem')
    expect(within(rows[0]!).getByText('21%')).toBeInTheDocument()
    expect(within(rows[0]!).getByText('Forecast')).toBeInTheDocument()
  })

  it('never prints a percentage for a lead with no measured skill', async () => {
    /* The whole point of the split: an outlook leans, it does not quantify. */
    wrap()
    const rows = await screen.findAllByRole('listitem')
    for (const row of rows.slice(1)) {
      expect(within(row).getByText('Outlook')).toBeInTheDocument()
      expect(within(row).queryByText(/^\d+%$/)).not.toBeInTheDocument()
    }
  })

  it('says which way an outlook leans, and why', async () => {
    wrap()
    const rows = await screen.findAllByRole('listitem')
    expect(within(rows[1]!).getByText('Drier than normal')).toBeInTheDocument()
    expect(within(rows[1]!).getByText(/leans the season drier/)).toBeInTheDocument()
    expect(within(rows[1]!).getByText('Moderate confidence')).toBeInTheDocument()
  })

  it('shows the measured skill for every lead rather than implying it', async () => {
    wrap()
    const rows = await screen.findAllByRole('listitem')
    expect(within(rows[0]!).getByText(/BSS 0\.058/)).toBeInTheDocument()
    expect(within(rows[2]!).getByText(/BSS -0\.021/)).toBeInTheDocument()
  })

  it('states the bar a lead had to clear, so the gate is checkable', async () => {
    wrap()
    expect(await screen.findByText('BSS ≥ 0.02')).toBeInTheDocument()
    expect(screen.getByText('r = -0.193')).toBeInTheDocument()
  })

  it('leads with how many months are worth a number', async () => {
    wrap()
    expect(await screen.findByText('1 of 3 months carry a probability')).toBeInTheDocument()
  })

  it('says plainly when no model is loaded', async () => {
    horizon.mockRejectedValue(new Error('nope'))
    wrap()
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
})
