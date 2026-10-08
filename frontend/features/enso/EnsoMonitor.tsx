'use client'

import { Activity, Compass, Info, ThermometerSun, TrendingDown, TrendingUp } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, XAxis, YAxis } from 'recharts'
import type { EnsoOutlookResponse } from '@agriminds/api-types'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardIcon, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { QueryError } from '@/components/ui/query-state'
import { Skeleton } from '@/components/ui/skeleton'
import { ensoPhase } from '@/lib/risk'
import { cn, formatSigned } from '@/lib/utils'

type Props = {
  data?: EnsoOutlookResponse
  isLoading: boolean
  isFetching: boolean
  error: unknown
  onRetry: () => void
}

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
        ...data.historical_series.map((p) => ({
          date: p.date,
          observed: p.nino34,
          forecast: null as number | null,
        })),
        ...(data.historical_series.length && data.forecast_series.length
          ? [
              {
                date: data.historical_series.at(-1)!.date,
                observed: null,
                forecast: data.historical_series.at(-1)!.nino34,
              },
            ]
          : []),
        ...data.forecast_series.map((p) => ({ date: p.date, observed: null, forecast: p.nino34 })),
      ]
    : []

  return (
    <Card>
      <CardHeader>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <CardIcon>
              <Activity />
            </CardIcon>
            <CardTitle>{t('title')}</CardTitle>
          </div>
          <CardDescription>{t('subtitle')}</CardDescription>
        </div>
        {data && (
          <Badge variant={PHASE_BADGE[phase]} className="self-start text-xs normal-case tracking-normal">
            {phase === 'warm' ? <TrendingUp /> : phase === 'cool' ? <TrendingDown /> : <ThermometerSun />}
            {data.current_state} ({formatSigned(current)} °C)
          </Badge>
        )}
      </CardHeader>

      <CardContent>
        {error && !data ? (
          <QueryError error={error} onRetry={onRetry} isRetrying={isFetching} />
        ) : isLoading && !data ? (
          <div className="flex flex-col gap-4" aria-busy aria-label={t('loading')}>
            <Skeleton className="h-16" />
            <Skeleton className="h-56" />
          </div>
        ) : data ? (
          <>
            <div className="rounded-xl border border-border bg-surface-sunken/70 p-3 sm:p-4">
              <div className="mb-2 flex items-center justify-between gap-2 text-[10px] font-black sm:text-[11px]">
                <span className="text-enso-cool">{t('laNina')}</span>
                <span className="hidden text-primary sm:inline">{t('neutral')}</span>
                <span className="text-enso-warm">{t('elNino')}</span>
              </div>
              <div className="relative h-3 overflow-hidden rounded-full bg-gradient-to-r from-enso-cool via-primary to-enso-warm shadow-inner">
                <div className="absolute inset-y-0 left-[40%] w-0.5 bg-surface-raised/70" />
                <div className="absolute inset-y-0 left-[60%] w-0.5 bg-surface-raised/70" />
              </div>
              <div className="relative mt-0.5 h-5">
                <div
                  className="absolute flex -translate-x-1/2 flex-col items-center transition-[left] duration-500"
                  style={{ left: `${needle}%` }}
                >
                  <div className="size-0 border-x-[5px] border-b-[6px] border-x-transparent border-b-fg" />
                  <span className="mt-0.5 font-mono text-[10px] font-black">{formatSigned(current)} °C</span>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2.5 rounded-xl border border-border bg-surface-sunken/60 p-3.5 text-xs leading-relaxed text-fg-muted">
              <Info className="mt-0.5 size-4 shrink-0 text-primary" />
              <p>
                <strong className="text-fg">{t('teleconnectionImpact')}: </strong>
                {data.teleconnection_summary}
              </p>
            </div>

            <div>
              <div className="mb-2.5 flex items-center justify-between text-xs font-bold">
                <span className="flex items-center gap-1.5">
                  <Compass className="size-3.5 text-primary" /> {t('outlookTitle')}
                </span>
                <span className="font-mono text-[10px] font-normal text-fg-subtle sm:text-[11px]">
                  {t('threshold')}
                </span>
              </div>
              <ChartContainer
                config={chartConfig}
                className="aspect-auto h-56 w-full"
                role="img"
                aria-label={t('chartAria')}
              >
                <LineChart data={series} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <ReferenceArea y1={-0.5} y2={0.5} fill="var(--color-primary)" fillOpacity={0.08} />
                  <ReferenceLine y={0.5} stroke="var(--color-enso-warm)" strokeDasharray="4 4" />
                  <ReferenceLine y={-0.5} stroke="var(--color-enso-cool)" strokeDasharray="4 4" />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    minTickGap={32}
                    fontSize={10}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={34}
                    fontSize={10}
                    tickFormatter={(v: number) => formatSigned(v, 1)}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    dataKey="observed"
                    name={t('observed')}
                    type="monotone"
                    stroke="var(--color-observed)"
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                  <Line
                    dataKey="forecast"
                    name={t('forecast')}
                    type="monotone"
                    stroke="var(--color-forecast)"
                    strokeWidth={2.5}
                    strokeDasharray="6 4"
                    dot={{ r: 3 }}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ChartContainer>

              {data.forecast_series.length === 0 ? (
                <p className="mt-3 text-center text-xs text-fg-subtle">{t('noForecast')}</p>
              ) : (
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
                  {data.forecast_series.map((pt, i) => {
                    const ph = ensoPhase(pt.nino34)
                    return (
                      <div
                        key={pt.date}
                        className="rounded-xl border border-border/80 bg-surface-raised p-2.5 text-center shadow-xs"
                      >
                        <div className="text-[10px] font-semibold text-fg-muted">
                          {t('monthPlus', { n: i + 1 })}
                        </div>
                        <div className="mt-0.5 font-mono text-[11px] font-bold">{pt.date}</div>
                        <div className={cn('mt-1 font-mono text-sm font-black sm:text-base', PHASE_TEXT[ph])}>
                          {formatSigned(pt.nino34)} °C
                        </div>
                        <div className="mt-0.5 text-[9px] font-bold uppercase text-fg-subtle">
                          {ph === 'warm' ? 'El Niño' : ph === 'cool' ? 'La Niña' : 'Neutral'}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}
