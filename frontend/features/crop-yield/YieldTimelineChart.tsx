'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, XAxis, YAxis } from 'recharts'
import type { CropYieldTimeline } from '@agriminds/api-types'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { SegmentedControl } from '@/components/ui/segmented'

/**
 * The whole record in two panels: belt-average yields over Niño 3.4, 1990 to 2030.
 *
 * Three claims of different strength sit on one time axis, and the chart's job is to keep them
 * visibly apart rather than draw one confident line through all of them:
 *
 *   to 2023  observed yields, observed ENSO            solid
 *   to 2026  projected yields, *observed* ENSO         dashed, unshaded
 *   to 2030  projected yields, *assumed* ENSO          dashed, over a shaded panel
 *
 * The scenario is a control rather than three simultaneous bands. Switching between El Niño and
 * La Niña moves the projection by a couple of percent, and a band that thin reads as a drawing
 * error; making the reader move it themselves shows the same fact and cannot be mistaken for one.
 */

const SCENARIO_KEYS = ['el_nino', 'neutral', 'la_nina'] as const
type ScenarioKey = (typeof SCENARIO_KEYS)[number]

const CROP_KEYS = ['tef', 'wheat', 'maize'] as const
type CropKey = (typeof CROP_KEYS)[number]

/** Crop hues, reused from the advisory palette so a crop is one colour across the app. */
const CROP_COLOUR: Record<CropKey, string> = {
  tef: 'var(--color-enso-warm)',
  wheat: 'var(--color-brand-clay)',
  maize: 'var(--color-pdsi-very-wet)',
}

type Row = {
  year: number
  nino: number | null
  ninoProjected: number | null
} & Partial<Record<CropKey | `${CropKey}Proj`, number | null>>

export function YieldTimelineChart({ data }: { data: CropYieldTimeline }) {
  const t = useTranslations('cropYield.timeline')
  const ta = useTranslations('advisory')
  const [scenario, setScenario] = useState<ScenarioKey>('neutral')

  const selected = data.scenarios.find((s) => s.key === scenario) ?? data.scenarios[0]

  const rows = useMemo<Row[]>(() => {
    const byYear = new Map<number, Row>()
    const touch = (year: number): Row => {
      let row = byYear.get(year)
      if (!row) {
        row = { year, nino: null, ninoProjected: null }
        byYear.set(year, row)
      }
      return row
    }

    for (const year of data.observed) {
      const row = touch(year.year)
      row.tef = year.tef_q_ha
      row.wheat = year.wheat_q_ha
      row.maize = year.maize_q_ha
    }
    for (const year of data.enso) {
      touch(year.year).nino = year.nino34
    }

    // The projection starts at the last observed season so the dashed run joins the solid one
    // instead of floating a gap the eye reads as missing data.
    const anchor = byYear.get(data.yields_observed_through)
    if (anchor) {
      anchor.tefProj = anchor.tef ?? null
      anchor.wheatProj = anchor.wheat ?? null
      anchor.maizeProj = anchor.maize ?? null
    }
    for (const year of selected?.years ?? []) {
      const row = touch(year.year)
      row.tefProj = year.tef_q_ha
      row.wheatProj = year.wheat_q_ha
      row.maizeProj = year.maize_q_ha
    }

    const ensoAnchor = byYear.get(data.enso_observed_through)
    if (ensoAnchor) ensoAnchor.ninoProjected = ensoAnchor.nino
    for (let year = data.enso_observed_through + 1; year <= data.through_year; year += 1) {
      touch(year).ninoProjected = selected?.enso_index ?? 0
    }

    return [...byYear.values()].sort((a, b) => a.year - b.year)
  }, [data, selected])

  const yieldConfig: ChartConfig = {
    tef: { label: ta('crops.tef.label'), color: CROP_COLOUR.tef },
    wheat: { label: ta('crops.wheat.label'), color: CROP_COLOUR.wheat },
    maize: { label: ta('crops.maize.label'), color: CROP_COLOUR.maize },
  }
  const ensoConfig: ChartConfig = {
    nino: { label: t('observedEnso'), color: 'var(--color-primary)' },
    ninoProjected: { label: t('assumedEnso'), color: 'var(--color-enso-warm)' },
  }

  // Where observation stops, per panel. They differ by three years and the chart says so.
  const yieldSplit = data.yields_observed_through
  const ensoSplit = data.enso_observed_through

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          size="sm"
          value={scenario}
          onChange={setScenario}
          options={SCENARIO_KEYS.map((key) => ({
            value: key,
            label: t(`scenario.${key}`),
            tone: key === 'el_nino' ? 'bad' : key === 'la_nina' ? 'primary' : 'neutral',
          }))}
          aria-label={t('scenarioLabel')}
        />
        <p className="text-xs text-fg-muted">
          {t('assumedFrom', { year: ensoSplit + 1, months: data.enso_forecast_limit_months })}
        </p>
      </div>

      <figure className="flex flex-col gap-1">
        <figcaption className="text-xs font-medium text-fg-muted">{t('yieldPanel')}</figcaption>
        <ChartContainer config={yieldConfig} className="aspect-auto h-[260px] w-full sm:h-[300px]">
          <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} />
            <ReferenceArea x1={ensoSplit} x2={data.through_year} fill="var(--color-fg-muted)" fillOpacity={0.07} />
            <ReferenceLine x={yieldSplit} stroke="var(--color-border)" strokeDasharray="3 3" />
            <XAxis dataKey="year" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={44}
              label={{ value: t('yieldUnit'), angle: -90, position: 'insideLeft', style: { fontSize: 11 } }}
            />
            <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
            {CROP_KEYS.map((crop) => (
              <Line
                key={crop}
                dataKey={crop}
                name={ta(`crops.${crop}.label`)}
                type="monotone"
                stroke={CROP_COLOUR[crop]}
                strokeWidth={2}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
            {CROP_KEYS.map((crop) => (
              <Line
                key={`${crop}Proj`}
                dataKey={`${crop}Proj`}
                name={`${ta(`crops.${crop}.label`)} · ${t('projected')}`}
                type="monotone"
                stroke={CROP_COLOUR[crop]}
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ChartContainer>
      </figure>

      <figure className="flex flex-col gap-1">
        <figcaption className="text-xs font-medium text-fg-muted">{t('ensoPanel')}</figcaption>
        <ChartContainer config={ensoConfig} className="aspect-auto h-[150px] w-full sm:h-[170px]">
          <LineChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} />
            <ReferenceArea x1={ensoSplit} x2={data.through_year} fill="var(--color-fg-muted)" fillOpacity={0.07} />
            <ReferenceArea y1={-0.5} y2={0.5} fill="var(--color-primary)" fillOpacity={0.07} />
            <ReferenceLine y={0} stroke="var(--color-border)" />
            <XAxis dataKey="year" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
            <YAxis tickLine={false} axisLine={false} width={44} domain={[-2, 2]} ticks={[-2, -1, 0, 1, 2]} />
            <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
            <Line
              dataKey="nino"
              name={t('observedEnso')}
              type="monotone"
              stroke="var(--color-primary)"
              strokeWidth={2}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
            <Line
              dataKey="ninoProjected"
              name={t('assumedEnso')}
              type="monotone"
              stroke="var(--color-enso-warm)"
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ChartContainer>
      </figure>

      <p className="text-xs leading-relaxed text-fg-muted">
        {t('footnote', {
          yieldYear: yieldSplit,
          ensoYear: ensoSplit,
          rmse: data.provenance.test_rmse_q_ha.toFixed(2),
        })}
      </p>
    </div>
  )
}
