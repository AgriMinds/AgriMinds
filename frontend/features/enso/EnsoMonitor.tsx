'use client'

import { Activity, Info, ThermometerSun, TrendingDown, TrendingUp } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, XAxis, YAxis } from 'recharts'
import type { EnsoOutlookResponse } from '@agriminds/api-types'
import { Badge } from '@/components/ui/badge'
import { Card, CardActions, CardContent, CardDescription, CardHeader, CardHeading, CardIcon, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { QueryError } from '@/components/ui/query-state'
import { Skeleton } from '@/components/ui/skeleton'
import { ensoPhase } from '@/lib/risk'
import { cn, formatSigned } from '@/lib/utils'

type Props = { data?: EnsoOutlookResponse; isLoading: boolean; isFetching: boolean; error: unknown; onRetry: () => void }

const chartConfig = {
  observed: { label: 'Observed', color: 'var(--color-fg)' },
  forecast: { label: 'Forecast', color: 'var(--color-enso-warm)' },
} satisfies ChartConfig

const PHASE_BADGE = { warm: 'bad', cool: 'default', neutral: 'ok' } as const
const PHASE_TEXT = { warm: 'text-enso-warm', cool: 'text-enso-cool', neutral: 'text-primary' } as const

export function EnsoMonitor({ data, isLoading, isFetching, error, onRetry }: Props) {
  const t = useTranslations('enso')
  const current = data?.current_nino34 ?? 0
  const phase = ensoPhase(current)
  const needle = ((Math.min(Math.max(current, -2.5), 2.5) + 2.5) / 5) * 100
  const series = data
    ? [
        ...data.historical_series.map((p) => ({ date: p.date, observed: p.nino34, forecast: null as number | null })),
        ...(data.historical_series.length && data.forecast_series.length
          ? [{ date: data.historical_series.at(-1)!.date, observed: null, forecast: data.historical_series.at(-1)!.nino34 }]
          : []),
        ...data.forecast_series.map((p) => ({ date: p.date, observed: null, forecast: p.nino34 })),
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
          <CardActions>
            <Badge variant={PHASE_BADGE[phase]} size="lg">
              {phase === 'warm' ? <TrendingUp /> : phase === 'cool' ? <TrendingDown /> : <ThermometerSun />}
              {data.current_state} · {formatSigned(current)} °C
            </Badge>
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
            {/* Left: current phase gauge + teleconnection text */}
            <div className="flex flex-col gap-4 lg:col-span-4">
              <div className="rounded-xl border border-border bg-surface-sunken/60 p-4">
                <p className="text-[11px] font-semibold tracking-wider text-fg-muted uppercase">{t('gaugeTitle')}</p>
                <div className={cn('mt-1 font-display text-stat font-bold tabular', PHASE_TEXT[phase])}>{formatSigned(current)} °C</div>
                <div className="relative mt-4 h-2.5 overflow-hidden rounded-full bg-gradient-to-r from-enso-cool via-surface-sunken to-enso-warm" aria-hidden>
                  <span className="absolute inset-y-0 left-[40%] w-px bg-fg/30" />
                  <span className="absolute inset-y-0 left-[60%] w-px bg-fg/30" />
                </div>
                <div className="relative h-4" aria-hidden>
                  <span className="absolute top-0 size-0 -translate-x-1/2 border-x-[6px] border-b-[7px] border-x-transparent border-b-fg transition-[left] duration-500" style={{ left: `${needle}%` }} />
                </div>
                <div className="flex justify-between text-[10px] font-semibold">
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
                  <ReferenceLine y={0.5} stroke="var(--color-enso-warm)" strokeDasharray="4 4" />
                  <ReferenceLine y={-0.5} stroke="var(--color-enso-cool)" strokeDasharray="4 4" />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={40} fontSize={10} stroke="var(--color-fg-subtle)" />
                  <YAxis tickLine={false} axisLine={false} width={36} fontSize={10} stroke="var(--color-fg-subtle)" tickFormatter={(v: number) => formatSigned(v, 1)} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line dataKey="observed" name={t('observed')} type="monotone" stroke="var(--color-observed)" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
                  <Line dataKey="forecast" name={t('forecast')} type="monotone" stroke="var(--color-forecast)" strokeWidth={2.5} strokeDasharray="6 4" dot={{ r: 3 }} connectNulls={false} isAnimationActive={false} />
                </LineChart>
              </ChartContainer>

              {data.forecast_series.length === 0 ? (
                <p className="text-center text-xs text-fg-subtle">{t('noForecast')}</p>
              ) : (
                <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(data.forecast_series.length, 6)}, minmax(0, 1fr))` }}>
                  {data.forecast_series.map((pt, i) => {
                    const ph = ensoPhase(pt.nino34)
                    return (
                      <div key={pt.date} className="rounded-xl border border-border bg-surface-raised p-3 text-center">
                        <div className="text-[10px] font-semibold text-fg-muted">{t('monthPlus', { n: i + 1 })}</div>
                        <div className="font-mono text-[11px] text-fg-subtle">{pt.date}</div>
                        <div className={cn('mt-1 font-display text-base font-bold tabular sm:text-lg', PHASE_TEXT[ph])}>{formatSigned(pt.nino34)}</div>
                        <div className="text-[10px] font-semibold tracking-wide text-fg-subtle uppercase">
                          {ph === 'warm' ? 'El Niño' : ph === 'cool' ? 'La Niña' : 'Neutral'}
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
    </Card>
  )
}
