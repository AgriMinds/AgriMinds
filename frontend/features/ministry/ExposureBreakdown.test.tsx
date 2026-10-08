import { render, screen, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { describe, expect, it } from 'vitest'
import type { RiskExposure } from '@agriminds/api-types'
import messages from '@/messages/en.json'
import { ExposureBreakdown } from '@/features/ministry/ExposureBreakdown'

const exposure: RiskExposure = {
  lead_month: 1,
  target_date: 'July 2026',
  buckets: [
    { risk_level: 'Low', farms: 18, farmers: 9, hectares: 30.5 },
    { risk_level: 'Moderate', farms: 5, farmers: 3, hectares: 7.25 },
    { risk_level: 'High', farms: 2, farmers: 2, hectares: 3.0 },
    { risk_level: 'Severe', farms: 0, farmers: 0, hectares: 0 },
  ],
  farms_at_risk: 2,
  farmers_at_risk: 2,
  hectares_at_risk: 3.0,
}

const wrap = (ui: React.ReactNode) =>
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  )

describe('ExposureBreakdown', () => {
  it('reports every level as numbers, not only as colour', () => {
    wrap(<ExposureBreakdown exposure={exposure} />)
    const table = screen.getByRole('table')
    const low = within(table).getByRole('row', { name: /Low/ })
    expect(within(low).getByText('18')).toBeInTheDocument()
    expect(within(low).getByText('30.5')).toBeInTheDocument()

    const severe = within(table).getByRole('row', { name: /Severe/ })
    expect(within(severe).getAllByText('0').length).toBeGreaterThan(0)
  })

  it('labels the bar for assistive technology', () => {
    wrap(<ExposureBreakdown exposure={exposure} />)
    expect(screen.getByRole('img')).toHaveAccessibleName('Low: 18, Moderate: 5, High: 2, Severe: 0')
  })

  it('names the month the exposure is for', () => {
    wrap(<ExposureBreakdown exposure={exposure} />)
    expect(screen.getByText('For July 2026')).toBeInTheDocument()
  })

  it('shows an empty state instead of a zero-width bar when nothing is registered', () => {
    wrap(
      <ExposureBreakdown
        exposure={{
          ...exposure,
          buckets: exposure.buckets.map((b) => ({ ...b, farms: 0, farmers: 0, hectares: 0 })),
          farms_at_risk: 0,
          farmers_at_risk: 0,
          hectares_at_risk: 0,
        }}
      />,
    )
    expect(screen.getByText('No plots registered yet.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})
