'use client'

/**
 * Crop yield outlook — /crop-yield (staff only)
 *
 * Section 1  Header + Niño 3.4 basis control
 * Section 2  Expected yield by crop and altitude belt (3 crops x 3 belts)
 * Section 3  What ENSO changes — the climate term on its own
 * Section 4  The model's stated limits, candidate scores and feature importance
 *
 * The model behind this page is a separate one (one spreadsheet, 306 rows) and it leans mostly
 * on last year's yield, so the page is built to say so: every number carries the inputs it came
 * from, the ENSO term is shown apart from the headline, and the artifact's own caveats are
 * rendered rather than paraphrased.
 */

import { CalendarRange, Sprout, TrendingDown, TrendingUp, Waves } from 'lucide-react'
import { useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import {
  AGRO_ZONES,
  CROPS,
  type AgroZone,
  type CropYieldCell,
  type CropYieldZone,
} from '@agriminds/api-types'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardHeading,
  CardIcon,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { QueryError } from '@/components/ui/query-state'
import { SegmentedControl } from '@/components/ui/segmented'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

import { EnsoResponseChart } from './EnsoResponseChart'
import { ModelLimits } from './ModelLimits'
import { useCropYieldModel, useCropYieldOutlook } from './useCropYield'

/** Leads offered for the ENSO basis: the observed month, then the skilful end of the forecast. */
const LEADS = [null, 1, 3, 6] as const

function signed(value: number, digits = 1): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(digits)}`
}

function YieldCell({ cell, baselineYear }: { cell: CropYieldCell; baselineYear: number }) {
  const t = useTranslations('cropYield')
  const change = cell.change_vs_last_observed_pct
  const up = change >= 0
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-surface-raised p-3 sm:p-3.5">
      <div className="flex items-baseline gap-1.5">
        <span className="font-display text-2xl font-bold tracking-tight tabular-nums">
          {cell.predicted_yield_q_ha.toFixed(1)}
        </span>
        <span className="text-[11px] text-fg-subtle">{t('unit')}</span>
      </div>
      <dl className="flex flex-col gap-0.5 text-[11px] text-fg-muted">
        <div className="flex items-center justify-between gap-2">
          <dt>{t('neutral')}</dt>
          <dd className="font-mono tabular-nums">
            {cell.neutral_yield_q_ha.toFixed(1)}{' '}
            <span className={cn(cell.enso_delta_pct < 0 ? 'text-risk-high' : 'text-primary')}>
              ({signed(cell.enso_delta_pct, 1)}%)
            </span>
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt>{t('lastObserved', { year: baselineYear })}</dt>
          <dd className="font-mono tabular-nums">{cell.last_observed_yield_q_ha.toFixed(1)}</dd>
        </div>
      </dl>
      <p
        className={cn(
          'flex items-center gap-1 text-[11px] font-medium',
          up ? 'text-status-ok' : 'text-risk-high',
        )}
      >
        {up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
        {signed(change, 1)}% {t('vsLast', { year: baselineYear })}
      </p>
    </div>
  )
}

type MatrixProps = {
  cells: CropYieldCell[]
  baselineYear: number
  /** Belt altitudes, from the model card. Absent until that query answers, and then omitted. */
  zones?: CropYieldZone[]
}

function Matrix({ cells, baselineYear, zones }: MatrixProps) {
  const t = useTranslations('cropYield')
  const ta = useTranslations('advisory')
  const byKey = new Map(cells.map((c) => [`${c.crop}|${c.zone}`, c]))
  const zoneOf = (zone: AgroZone) => cells.find((c) => c.zone === zone)
  const bandOf = (zone: AgroZone) => zones?.find((z) => z.zone === zone)

  return (
    <div className="flex flex-col gap-3">
      {/* Belt headings: shown once on wide screens, repeated per crop on a phone. */}
      <div className="hidden gap-3 sm:grid sm:grid-cols-[7rem_repeat(3,minmax(0,1fr))]">
        <span />
        {AGRO_ZONES.map((zone) => {
          const band = bandOf(zone)
          return (
            <div key={zone} className="flex flex-col gap-0.5 px-1">
              <span className="text-xs font-semibold">{zoneOf(zone)?.zone_local_name ?? zone}</span>
              <span className="text-[11px] text-fg-subtle">
                {band
                  ? `${zone} · ${t('altitudeBand', { min: band.altitude_min_m, max: band.altitude_max_m })}`
                  : zone}
              </span>
            </div>
          )
        })}
      </div>
      {CROPS.map((crop) => (
        <div key={crop} className="flex flex-col gap-2 sm:grid sm:grid-cols-[7rem_repeat(3,minmax(0,1fr))] sm:items-center sm:gap-3">
          <div className="flex min-w-0 items-center gap-2 sm:flex-col sm:items-start sm:gap-0.5">
            <span className="text-sm font-semibold">{ta(`crops.${crop}.label`)}</span>
            <span className="truncate text-[11px] text-fg-subtle">{ta(`crops.${crop}.desc`)}</span>
          </div>
          {AGRO_ZONES.map((zone) => {
            const cell = byKey.get(`${crop}|${zone}`)
            return (
              <div key={zone} className="flex flex-col gap-1">
                <span className="text-[11px] font-medium text-fg-muted sm:hidden">
                  {cell?.zone_local_name ?? zone}
                </span>
                {cell ? (
                  <YieldCell cell={cell} baselineYear={baselineYear} />
                ) : (
                  <Skeleton className="h-28" />
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

export function CropYieldPage() {
  const t = useTranslations('cropYield')
  const format = useFormatter()
  const [leadIndex, setLeadIndex] = useState(0)
  const leadMonth = LEADS[leadIndex] ?? undefined

  const outlook = useCropYieldOutlook(leadMonth ? { leadMonth } : undefined)
  const card = useCropYieldModel()

  const basisOptions = LEADS.map((lead, index) => ({
    value: index,
    label: lead === null ? t('basisObserved') : t('basisForecast', { months: lead }),
    hint: lead === null ? t('basisHintObserved') : t('basisHintForecast'),
  }))

  const data = outlook.data
  const provenance = data?.provenance ?? card.data?.provenance
  const basisLabel = data
    ? data.enso_basis === 'forecast'
      ? t('sourceForecast', { lead: data.lead_month ?? 0 })
      : data.enso_basis === 'observed'
        ? t('sourceObserved')
        : t('sourceDataset')
    : ''

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <header className="flex flex-col gap-3">
        <span className="text-[11px] font-semibold tracking-[0.18em] text-primary uppercase">
          {t('eyebrow')}
        </span>
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{t('title')}</h1>
        <p className="max-w-prose text-sm leading-relaxed text-fg-muted">
          {t('intro', {
            firstYear: provenance?.record_years[0] ?? 1990,
            lastYear: provenance?.record_years[1] ?? 2023,
          })}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardHeading>
            <CardIcon>
              <Waves />
            </CardIcon>
            <div className="min-w-0">
              <CardTitle>{t('basis')}</CardTitle>
              <CardDescription>
                {data
                  ? `${t('conditionedOn', {
                      index: signed(data.enso_index, 2),
                      phase: data.enso_phase,
                    })} — ${basisLabel}`
                  : t('basisHintObserved')}
              </CardDescription>
            </div>
          </CardHeading>
          {data && (
            <Badge variant="outline" className="gap-1.5">
              <CalendarRange />
              {t('season', { year: data.year })}
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          <SegmentedControl
            options={basisOptions}
            value={leadIndex}
            onChange={setLeadIndex}
            variant="tile"
            aria-label={t('basis')}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardHeading>
            <CardIcon>
              <Sprout />
            </CardIcon>
            <div className="min-w-0">
              <CardTitle>{t('matrixTitle')}</CardTitle>
              <CardDescription>{t('matrixDesc')}</CardDescription>
            </div>
          </CardHeading>
        </CardHeader>
        <CardContent>
          {outlook.isError ? (
            <QueryError error={outlook.error} onRetry={() => outlook.refetch()} isRetrying={outlook.isFetching} />
          ) : data ? (
            <Matrix cells={data.cells} baselineYear={data.baseline_year} zones={card.data?.zones} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              {Array.from({ length: 9 }, (_, i) => (
                <Skeleton key={i} className="h-28" />
              ))}
            </div>
          )}
        </CardContent>
        {provenance && (
          <CardFooter>
            <span>{t('trainedOn', { file: provenance.dataset_file })}</span>
            <span>
              {t('holdout', {
                rmse: provenance.test_rmse_q_ha.toFixed(2),
                r2: provenance.test_r2.toFixed(3),
              })}
            </span>
            <span>
              {t('trainedAt', {
                date: format.dateTime(new Date(provenance.trained_at), 'date'),
              })}
            </span>
            <span className="text-fg-subtle">{t('notPlotLevel')}</span>
          </CardFooter>
        )}
      </Card>

      {data && (
        <Card>
          <CardHeader>
            <CardHeading>
              <CardIcon>
                <Waves />
              </CardIcon>
              <div className="min-w-0">
                <CardTitle>{t('ensoTitle')}</CardTitle>
                <CardDescription>{t('ensoDesc')}</CardDescription>
              </div>
            </CardHeading>
          </CardHeader>
          <CardContent>
            <EnsoResponseChart cells={data.cells} />
          </CardContent>
        </Card>
      )}

      {card.isError ? (
        <QueryError error={card.error} onRetry={() => card.refetch()} isRetrying={card.isFetching} />
      ) : card.data ? (
        <ModelLimits card={card.data} />
      ) : (
        <Skeleton className="h-40" />
      )}
    </div>
  )
}
