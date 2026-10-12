'use client'

/**
 * El Niño impacts and crop recommendations — /crop-yield (staff only)
 *
 * 1  ENSO driver                 live Niño 3.4 on the warm/cool scale, and the two mechanisms
 * 2  El Niño impact on yields    what the 1990-2023 record shows, per crop and belt, with p
 * 3  Recommended crop per belt   derived from that matrix, never hand-written
 * 4  Recommended actions         three standing practices plus two derived from the record
 * 5  Expected yield next season  the fitted model, its ENSO term, and its stated limits
 *
 * Two different claims live on this page and are deliberately kept apart. Sections 2-4 are the
 * *record*: what happened in the eight El Niño years it contains. Section 5 is the *model*: what
 * the fitted regressor predicts for the season ahead. Neither borrows the other's authority, and
 * both carry the statistics that qualify them.
 */

import { CalendarRange, Sprout, TrendingDown, TrendingUp, Waves } from 'lucide-react'
import { useState, type CSSProperties } from 'react'
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
import { useEnsoOutlook } from '@/features/enso/useEnsoOutlook'
import { cn } from '@/lib/utils'

import { ActionStrip } from './ActionStrip'
import { CropGlyph } from './CropArt'
import { BeltRecommendations } from './BeltRecommendations'
import { EnsoDriverCard } from './EnsoDriverCard'
import { EnsoResponseChart } from './EnsoResponseChart'
import { ImpactMatrix } from './ImpactMatrix'
import { ModelLimits } from './ModelLimits'
import { SectionBanner } from './SectionBanner'
import { useCropYieldModel, useCropYieldOutlook, useEnsoImpact } from './useCropYield'

/** Leads offered for the ENSO basis: the observed month, then the skilful end of the forecast. */
const LEADS = [null, 1, 3, 6] as const

/** Staggered entrance, matching the ministry dashboard. */
const delay = (ms: number): CSSProperties => ({ '--reveal-delay': `${ms}ms` }) as CSSProperties

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
        <div
          key={crop}
          className="flex flex-col gap-2 sm:grid sm:grid-cols-[7rem_repeat(3,minmax(0,1fr))] sm:items-center sm:gap-3"
        >
          <div className="flex min-w-0 items-center gap-2 sm:items-start">
            <CropGlyph crop={crop} className="size-5 shrink-0 text-fg-muted sm:mt-0.5" />
            <span className="min-w-0 leading-tight">
              <span className="block text-sm font-semibold">{ta(`crops.${crop}.label`)}</span>
              <span className="hidden truncate text-[11px] text-fg-subtle sm:block">
                {ta(`crops.${crop}.desc`)}
              </span>
            </span>
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
  const impact = useEnsoImpact()
  const enso = useEnsoOutlook()

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
    <>
      {/* Hero band, matching the other staff pages: texture, title, and the live reading. */}
      <div className="bg-contour border-b border-border">
        <div
          className="h-1 w-full bg-gradient-to-r from-[#078930] via-[#FCDD09] to-[#DA121A]"
          aria-hidden
        />
        <div className="mx-auto flex max-w-[1600px] flex-col gap-4 px-4 pt-6 pb-6 sm:px-6 sm:pt-8 lg:flex-row lg:items-end lg:justify-between lg:px-8 lg:pt-10 lg:pb-8">
          <div className="reveal max-w-3xl">
            <p className="text-[11px] font-semibold tracking-[0.16em] text-primary uppercase">
              {t('eyebrow')}
            </p>
            <h1 className="mt-2 font-display text-display-sm font-bold tracking-tight sm:text-display">
              {t('title')}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-fg-muted sm:text-base">
              {t('intro', {
                firstYear: provenance?.record_years[0] ?? 1990,
                lastYear: provenance?.record_years[1] ?? 2023,
              })}
            </p>
          </div>
          {impact.data && (
            <div
              className="reveal flex shrink-0 gap-3 rounded-2xl border border-border bg-surface-raised/80 p-3 backdrop-blur-xs sm:gap-5 sm:p-4"
              style={delay(80)}
            >
              <div className="min-w-0">
                <p className="text-[10px] font-semibold tracking-wider text-fg-subtle uppercase">
                  {t('heroOverall')}
                </p>
                <p className="font-display text-2xl font-bold text-risk-high tabular-nums sm:text-3xl">
                  {impact.data.overall_effect_pct.toFixed(2)}%
                </p>
              </div>
              <div className="min-w-0 border-l border-border pl-3 sm:pl-5">
                <p className="text-[10px] font-semibold tracking-wider text-fg-subtle uppercase">
                  {t('heroSample')}
                </p>
                <p className="font-display text-2xl font-bold tabular-nums sm:text-3xl">
                  {impact.data.el_nino_years.length}
                </p>
                <p className="text-[10px] text-fg-subtle">
                  {t('heroYears', {
                    from: impact.data.record_years[0] ?? 1990,
                    to: impact.data.record_years[1] ?? 2023,
                  })}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 px-4 py-5 sm:px-6 sm:py-6 lg:gap-6 lg:px-8 lg:py-8">
        {/* Sections 1-3 sit side by side once there is room, as on the printed sheet. */}
        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-12 xl:gap-6">
          {/* 1 — the driver */}
          <section className="reveal flex flex-col gap-3 xl:col-span-3" style={delay(120)}>
            <SectionBanner index={1} title={t('driver.title')} tone="red" />
            <Card className="p-3.5 sm:p-4">
              {enso.isError ? (
                <QueryError
                  error={enso.error}
                  onRetry={() => void enso.refetch()}
                  isRetrying={enso.isFetching}
                />
              ) : (
                <EnsoDriverCard data={enso.data} />
              )}
            </Card>
          </section>

          {/* 2 — what the record shows */}
          <section className="reveal flex flex-col gap-3 xl:col-span-6" style={delay(160)}>
            <SectionBanner index={2} title={t('impact.title')} tone="navy" />
            <Card className="p-3.5 sm:p-5">
              <CardHeader>
                <CardHeading>
                  <CardIcon>
                    <Waves />
                  </CardIcon>
                  <div className="min-w-0">
                    <CardTitle>{t('impact.cardTitle')}</CardTitle>
                    <CardDescription>{t('impact.cardDesc')}</CardDescription>
                  </div>
                </CardHeading>
              </CardHeader>
              <CardContent>
                {impact.isError ? (
                  <QueryError
                    error={impact.error}
                    onRetry={() => void impact.refetch()}
                    isRetrying={impact.isFetching}
                  />
                ) : impact.data ? (
                  <ImpactMatrix data={impact.data} />
                ) : (
                  <Skeleton className="h-64" />
                )}
              </CardContent>
            </Card>
          </section>

          {/* 3 — what to plant where */}
          <section className="reveal flex flex-col gap-3 xl:col-span-3" style={delay(200)}>
            <SectionBanner index={3} title={t('bannerBelts')} tone="green" />
            <Card className="gap-4 p-3.5 sm:p-4">
              <CardHeader>
                <CardHeading>
                  <CardIcon>
                    <Sprout />
                  </CardIcon>
                  <div className="min-w-0">
                    <CardTitle className="text-sm sm:text-base">{t('belts.cardTitle')}</CardTitle>
                    <CardDescription>{t('belts.cardDesc')}</CardDescription>
                  </div>
                </CardHeading>
              </CardHeader>
              <CardContent>
                {impact.data ? (
                  <BeltRecommendations data={impact.data} />
                ) : (
                  <Skeleton className="h-48" />
                )}
              </CardContent>
            </Card>
          </section>
        </div>

        {/* 4 — what to do */}
        <section className="reveal flex flex-col gap-3" style={delay(240)}>
          <SectionBanner index={4} title={t('actions.title')} tone="violet" />
          {impact.data ? <ActionStrip data={impact.data} /> : <Skeleton className="h-28" />}
        </section>

        {/* 5 — what the model expects next season */}
        <section className="reveal flex flex-col gap-3" style={delay(280)}>
          <SectionBanner
            index={5}
            title={t('bannerModel')}
            tone="teal"
            action={
              data ? (
                <Badge variant="outline" className="hidden gap-1.5 border-white/25 bg-white/10 text-white sm:inline-flex">
                  <CalendarRange />
                  {t('season', { year: data.year })}
                </Badge>
              ) : undefined
            }
          />

          <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-12 xl:gap-6">
            <div className="flex flex-col gap-5 xl:col-span-7">
              <Card className="p-3.5 sm:p-5">
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

              <Card className="p-3.5 sm:p-5">
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
                    <QueryError
                      error={outlook.error}
                      onRetry={() => void outlook.refetch()}
                      isRetrying={outlook.isFetching}
                    />
                  ) : data ? (
                    <Matrix
                      cells={data.cells}
                      baselineYear={data.baseline_year}
                      zones={card.data?.zones}
                    />
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
            </div>

            <div className="flex flex-col gap-5 xl:col-span-5">
              {data && (
                <Card className="p-3.5 sm:p-5">
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
            </div>
          </div>

          {card.isError ? (
            <QueryError
              error={card.error}
              onRetry={() => void card.refetch()}
              isRetrying={card.isFetching}
            />
          ) : card.data ? (
            <ModelLimits card={card.data} />
          ) : (
            <Skeleton className="h-40" />
          )}
        </section>
      </div>
    </>
  )
}
