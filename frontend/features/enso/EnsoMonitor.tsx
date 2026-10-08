'use client'

import { Activity, Info, TriangleAlert } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, XAxis, YAxis } from 'recharts'
import type { EnsoCategory, EnsoOutlookResponse } from '@agriminds/api-types'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardActions,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardHeading,
  CardIcon,
  CardTitle,
} from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { QueryError } from '@/components/ui/query-state'
import { Skeleton } from '@/components/ui/skeleton'
import { ENSO_BADGE_VARIANT, ENSO_ICON, ENSO_TEXT_CLASS, ensoKey } from '@/lib/classification'
import { cn, formatSigned } from '@/lib/utils'

type Props = { data?: EnsoOutlookResponse; isLoading: boolean; isFetching: boolean; error: unknown; onRetry: () => void }

const chartConfig = {
  observed: { label: 'Observed', color: 'var(--color-fg)' },
  forecast: { label: 'Forecast', color: 'var(--color-enso-warm)' },
} satisfies ChartConfig

/** The gauge spans ±2.5 °C, so a value maps linearly onto that window. */
const GAUGE_SPAN = 2.5
const position = (v: number) => ((Math.min(Math.max(v, -GAUGE_SPAN), GAUGE_SPAN) + GAUGE_SPAN) / (GAUGE_SPAN * 2)) * 100

/** Table 2's band edges, drawn on the gauge so the five bands can actually be read off it. */
const BOUNDARIES = [-1, -0.5, 0.5, 1] as const

export function EnsoMonitor({ data, isLoading, isFetching, error, onRetry }: Props) {
  const t = useTranslations('enso')
  const tb = useTranslations('ensoBand')
  const current = data?.current_nino34 ?? 0
  const band = (data?.current_category ?? 'Neutral') as EnsoCategory
  const BandIcon = ENSO_ICON[band]
  const needle = position(current)

  const bandName = (c?: EnsoCategory | null) => (c ? tb(ensoKey(c)) : '')
  const series = data
    ? [
        ...data.historical_series.map((p) => ({
          date: p.date,
          observed: p.nino34,
          forecast: null as number | null,
          band: bandName(p.category),
        })),
        ...(data.historical_series.length && data.forecast_series.length
          ? [
              {
                date: data.historical_series.at(-1)!.date,
                observed: null,
                forecast: data.historical_series.at(-1)!.nino34,
                band: bandName(data.historical_series.at(-1)!.category),
              },
            ]
          : []),
        ...data.forecast_series.map((p) => ({
          date: p.date,
          observed: null,
          forecast: p.nino34,
          band: bandName(p.category),
        })),
      ]
    : []

  return (
    <Card>
      <CardHeader>
        <CardHeading>
          <CardIcon>
            <Activity />
          </CardIcon>
          <div className="min-w-0">
            <CardTitle>{t('title')}</CardTitle>
            <CardDescription>{t('subtitle')}</CardDescription>
          </div>
        </CardHeading>
        {data && (
          <CardActions className="flex-wrap">
            <Badge variant={ENSO_BADGE_VARIANT[band]} size="lg">
              <BandIcon />
              {bandName(band)} · {formatSigned(current)} °C
            </Badge>
            {data.is_extreme && (
              <Badge variant="bad" size="lg">
                <TriangleAlert /> {t('extremeFlag')}
              </Badge>
            )}
          </CardActions>
        )}
      </CardHeader>

      <CardContent>
        {error && !data ? (
          <QueryError error={error} onRetry={onRetry} isRetrying={isFetching} />
        ) : isLoading && !data ? (
          <div className="grid gap-4 lg:grid-cols-12" aria-busy aria-label={t('loading')}>
            <Skeleton className="h-48 lg:col-span-4" />
            <Skeleton className="h-72 lg:col-span-8" />
          </div>
        ) : data ? (
          <div className="grid gap-5 lg:grid-cols-12">
            {/* Left: current band gauge + teleconnection text */}
            <div className="flex flex-col gap-4 lg:col-span-4">
              <div className="rounded-xl border border-border bg-surface-sunken/60 p-4">
                <p className="text-[11px] font-semibold tracking-wider text-fg-muted uppercase">{t('gaugeTitle')}</p>
                <div className={cn('mt-1 font-display text-stat font-bold tabular', ENSO_TEXT_CLASS[band])}>
                  {formatSigned(current)} °C
                </div>
                <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-sm">
                  <span className={cn('font-semibold', ENSO_TEXT_CLASS[band])}>{bandName(band)}</span>
                  {/* The coarse three-way phase is shown only when it says something different —
                      "Neutral (Neutral)" is noise. */}
                  {data.current_state !== band && (
                    <span className="text-xs text-fg-muted">({data.current_state})</span>
                  )}
                </p>

                <div
                  className="relative mt-4 h-2.5 overflow-hidden rounded-full bg-gradient-to-r from-enso-cool via-surface-sunken to-enso-warm"
                  aria-hidden
                >
                  {BOUNDARIES.map((b) => (
                    <span key={b} className="absolute inset-y-0 w-px bg-fg/35" style={{ left: `${position(b)}%` }} />
                  ))}
                </div>
                <div className="relative h-4" aria-hidden>
                  <span
                    className="absolute top-0 size-0 -translate-x-1/2 border-x-[6px] border-b-[7px] border-x-transparent border-b-fg transition-[left] duration-500"
                    style={{ left: `${needle}%` }}
                  />
                </div>
                {/* Numeric edges of Table 2's bands. */}
                <div className="relative h-3.5 text-[9px] font-medium text-fg-subtle tabular" aria-hidden>
                  {BOUNDARIES.map((b) => (
                    <span key={b} className="absolute -translate-x-1/2" style={{ left: `${position(b)}%` }}>
                      {formatSigned(b, 1)}
                    </span>
                  ))}
                </div>
                <div className="mt-0.5 flex justify-between text-[10px] font-semibold">
                  <span className="text-enso-cool">{t('laNina')}</span>
                  <span className="text-fg-subtle">{t('neutral')}</span>
                  <span className="text-enso-warm">{t('elNino')}</span>
                </div>
              </div>
              <p className="flex items-start gap-2.5 text-xs leading-relaxed text-fg-muted">
                <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <span>
                  <strong className="font-semibold text-fg">{t('teleconnectionImpact')}: </strong>
                  {data.teleconnection_summary}
                </span>
              </p>
            </div>

            {/* Right: history + forecast chart, then per-lead tiles */}
            <div className="flex flex-col gap-4 lg:col-span-8">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold">{t('outlookTitle')}</span>
                <span className="flex items-center gap-3 text-fg-subtle">
                  <span className="flex items-center gap-1.5">
                    <span className="h-0.5 w-4 bg-fg" aria-hidden /> {t('observed')}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-0.5 w-4 border-t-2 border-dashed border-enso-warm" aria-hidden /> {t('forecast')}
                  </span>
                </span>
              </div>
              <ChartContainer config={chartConfig} className="aspect-auto h-60 w-full sm:h-64" role="img" aria-label={t('chartAria')}>
                <LineChart data={series} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--color-border)" />
                  <ReferenceArea y1={-0.5} y2={0.5} fill="var(--color-primary)" fillOpacity={0.07} />
                  <ReferenceLine y={1} stroke="var(--color-enso-warm)" strokeDasharray="2 4" strokeOpacity={0.7} />
                  <ReferenceLine y={0.5} stroke="var(--color-enso-warm)" strokeDasharray="4 4" />
                  <ReferenceLine y={-0.5} stroke="var(--color-enso-cool)" strokeDasharray="4 4" />
                  <ReferenceLine y={-1} stroke="var(--color-enso-cool)" strokeDasharray="2 4" strokeOpacity={0.7} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={40} fontSize={10} stroke="var(--color-fg-subtle)" />
                  <YAxis tickLine={false} axisLine={false} width={36} fontSize={10} stroke="var(--color-fg-subtle)" tickFormatter={(v: number) => formatSigned(v, 1)} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        // The band is what the reader is meant to act on, so it leads the tooltip.
                        labelFormatter={(label, payload) => {
                          const point = payload?.[0]?.payload as { band?: string } | undefined
                          return point?.band ? `${label} · ${point.band}` : String(label)
                        }}
                      />
                    }
                  />
                  <Line dataKey="observed" name={t('observed')} type="monotone" stroke="var(--color-observed)" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
                  <Line dataKey="forecast" name={t('forecast')} type="monotone" stroke="var(--color-forecast)" strokeWidth={2.5} strokeDasharray="6 4" dot={{ r: 3 }} connectNulls={false} isAnimationActive={false} />
                </LineChart>
              </ChartContainer>

              {data.forecast_series.length === 0 ? (
                <p className="text-center text-xs text-fg-subtle">{t('noForecast')}</p>
              ) : (
                <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(data.forecast_series.length, 6)}, minmax(0, 1fr))` }}>
                  {data.forecast_series.map((pt, i) => {
                    const pointBand = (pt.category ?? 'Neutral') as EnsoCategory
                    const PointIcon = ENSO_ICON[pointBand]
                    return (
                      <div key={pt.date} className="rounded-xl border border-border bg-surface-raised p-3 text-center">
                        <div className="text-[10px] font-semibold text-fg-muted">{t('monthPlus', { n: i + 1 })}</div>
                        <div className="font-mono text-[11px] text-fg-subtle">{pt.date}</div>
                        <div className={cn('mt-1 font-display text-base font-bold tabular sm:text-lg', ENSO_TEXT_CLASS[pointBand])}>
                          {formatSigned(pt.nino34)}
                        </div>
                        <div className="mt-0.5 flex items-center justify-center gap-1 text-[10px] font-semibold text-fg-subtle">
                          <PointIcon className="size-3 shrink-0" aria-hidden />
                          <span className="truncate">{bandName(pointBand)}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </CardContent>

      {data && (
        <CardFooter className="text-[10px] text-fg-subtle">
          <span>
            {t('sourceLabel')}: {data.citation}
          </span>
          <span className="font-mono">
            {t('versionLabel')} {data.classification_version}
          </span>
        </CardFooter>
      )}
    </Card>
  )
}
