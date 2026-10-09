'use client'

import { CalendarRange, CheckCircle2, CircleDashed, Droplets, TrendingDown } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { LeadHorizon } from '@agriminds/api-types'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardHeading, CardIcon, CardTitle } from '@/components/ui/card'
import { QueryError } from '@/components/ui/query-state'
import { Skeleton } from '@/components/ui/skeleton'
import { useHorizon } from '@/features/prediction/usePrediction'
import { cn } from '@/lib/utils'

/** How each direction reads at a glance. Never colour alone: an icon and a word carry it too. */
const DIRECTION = {
  drier: { icon: TrendingDown, badge: 'warn' as const, tone: 'text-status-warn' },
  wetter: { icon: Droplets, badge: 'default' as const, tone: 'text-primary' },
  'near normal': { icon: CircleDashed, badge: 'outline' as const, tone: 'text-fg-subtle' },
} satisfies Record<string, { icon: typeof TrendingDown; badge: NonNullable<BadgeProps['variant']>; tone: string }>

function monthLabel(target: string, locale: string) {
  return new Date(target).toLocaleDateString(locale, { month: 'long', year: 'numeric' })
}

/**
 * One month of the horizon.
 *
 * A forecast and an outlook are drawn differently on purpose. The forecast is the only row that
 * gets to show a number, and it carries the skill that earned it; an outlook shows a direction
 * and the reasoning, and never a percentage. Making them look alike would undo the distinction
 * the whole page exists to make.
 */
function LeadRow({ lead, locale }: { lead: LeadHorizon; locale: string }) {
  const t = useTranslations('prediction')
  const isForecast = lead.kind === 'forecast'
  const direction = DIRECTION[(lead.direction ?? 'near normal') as keyof typeof DIRECTION]
  const Icon = isForecast ? CheckCircle2 : direction.icon
  const bss = lead.skill?.bss_vs_climatology

  return (
    <li
      className={cn(
        'flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-start sm:gap-4',
        isForecast ? 'border-status-ok/40 bg-status-ok/[0.04]' : 'border-dashed border-border bg-surface-sunken/40',
      )}
    >
      <span className="flex items-center gap-3 sm:w-44 sm:shrink-0">
        <Icon className={cn('size-5 shrink-0', isForecast ? 'text-status-ok' : direction.tone)} aria-hidden />
        <span className="leading-tight">
          <span className="block font-display text-sm font-semibold">{monthLabel(lead.target_month, locale)}</span>
          <span className="block text-[11px] text-fg-subtle">{t('inMonths', { count: lead.lead_month })}</span>
        </span>
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {isForecast ? (
            <>
              <span className="font-display text-xl font-bold tabular-nums">
                {Math.round((lead.probability ?? 0) * 100)}%
              </span>
              <Badge variant="ok">{t('forecast')}</Badge>
            </>
          ) : (
            <>
              <span className="font-display text-sm font-semibold">{t(`direction.${lead.direction ?? 'near normal'}`)}</span>
              <Badge variant={direction.badge}>{t('outlook')}</Badge>
              <Badge variant="outline" size="sm">{t(`confidence.${lead.confidence ?? 'low'}`)}</Badge>
            </>
          )}
        </div>

        <p className="text-sm leading-relaxed text-fg-muted">
          {isForecast
            ? t('forecastDetail', {
                cells: lead.cells_at_risk ?? 0,
                max: Math.round((lead.max_probability ?? 0) * 100),
              })
            : (lead.basis ?? t('noBasis'))}
        </p>

        {bss != null && (
          <p className="font-mono text-[11px] text-fg-subtle">
            {t('skillLine', {
              bss: bss.toFixed(3),
              auc: (lead.skill?.auc ?? 0).toFixed(2),
            })}
          </p>
        )}
      </div>
    </li>
  )
}

/**
 * What the platform will and will not predict, month by month.
 *
 * The honest shape of this page is the deliverable. A reader arrives wanting twelve numbers; the
 * page gives them the one that was measured to be worth having and explains, for each of the
 * other eleven, what is known instead. That is less than they hoped for and more than they would
 * get from a page that printed twelve numbers.
 */
export function PredictionHorizon({ locale }: { locale: string }) {
  const t = useTranslations('prediction')
  const { data, error, isPending, isFetching, refetch } = useHorizon()

  return (
    <>
      <div className="bg-contour border-b border-border">
        <div className="mx-auto flex max-w-[1100px] flex-col gap-2 px-4 pt-8 pb-7 sm:px-6 lg:px-8">
          <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-primary uppercase">
            <CalendarRange className="size-3.5" aria-hidden /> {t('eyebrow')}
          </p>
          <h1 className="font-display text-display font-bold">{t('title')}</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-fg-muted sm:text-base">{t('intro')}</p>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {isPending ? (
          <Skeleton className="h-96 rounded-2xl" />
        ) : error ? (
          <QueryError error={error} onRetry={() => void refetch()} isRetrying={isFetching} />
        ) : !data ? (
          <Card className="mx-auto max-w-2xl text-center">
            <p className="text-sm text-fg-muted">{t('unavailable')}</p>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardHeading>
                  <CardIcon>
                    <CalendarRange />
                  </CardIcon>
                  <div className="min-w-0">
                    <CardTitle>
                      {t('headline', { skilful: data.skilful_leads.length, trained: data.trained_leads })}
                    </CardTitle>
                    <CardDescription>{data.note}</CardDescription>
                  </div>
                </CardHeading>
              </CardHeader>
              <CardContent>
                <dl className="flex flex-col gap-x-8 gap-y-2 text-xs sm:flex-row sm:flex-wrap">
                  <div className="flex gap-1.5">
                    <dt className="text-fg-subtle">{t('issued')}</dt>
                    <dd className="font-mono font-medium text-fg">{data.issued_date}</dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt className="text-fg-subtle">{t('threshold')}</dt>
                    <dd className="font-mono font-medium text-fg">BSS ≥ {data.min_skilful_bss}</dd>
                  </div>
                  {data.teleconnection_r != null && (
                    <div className="flex gap-1.5">
                      <dt className="text-fg-subtle">{t('teleconnection')}</dt>
                      <dd className="font-mono font-medium text-fg">r = {data.teleconnection_r}</dd>
                    </div>
                  )}
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardHeading>
                  <div className="min-w-0">
                    <CardTitle>{t('monthByMonth')}</CardTitle>
                    <CardDescription>{t('monthByMonthLead')}</CardDescription>
                  </div>
                </CardHeading>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-3">
                  {data.leads.map((lead) => (
                    <LeadRow key={lead.lead_month} lead={lead} locale={locale} />
                  ))}
                </ul>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </>
  )
}
