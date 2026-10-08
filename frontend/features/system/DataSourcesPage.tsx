'use client'

import { AlertTriangle, CheckCircle2, CircleDashed, Database, FlaskConical, type LucideIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { DataInventory } from '@agriminds/api-types'
import { Badge, type BadgeProps } from '@/components/ui/badge'
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
import { QueryError } from '@/components/ui/query-state'
import { Skeleton } from '@/components/ui/skeleton'
import { useDataSources } from '@/features/system/useDataSources'
import { cn } from '@/lib/utils'

type Status = DataInventory['sources'][number]['status']

/**
 * How each state is drawn.
 *
 * Three signals carry the status — an icon, a worded badge and the row's border — because a
 * reviewer printing this page in greyscale, or anyone who does not distinguish green from amber,
 * still has to be able to tell a real feed from a stand-in. Colour is never the only cue.
 */
const TREATMENT: Record<Status, { icon: LucideIcon; badge: NonNullable<BadgeProps['variant']>; label: string; row: string; mark: string }> = {
  connected: {
    icon: CheckCircle2,
    badge: 'ok',
    label: 'statusConnected',
    row: 'border-status-ok/35 bg-status-ok/[0.04]',
    mark: 'text-status-ok',
  },
  synthetic: {
    icon: FlaskConical,
    badge: 'warn',
    label: 'statusSynthetic',
    // Dashed: the slot is filled, but not by anything observed.
    row: 'border-dashed border-status-warn/55 bg-status-warn/[0.05]',
    mark: 'text-fg',
  },
  not_connected: {
    icon: CircleDashed,
    badge: 'outline',
    label: 'statusNotConnected',
    row: 'border-border bg-surface-sunken/40',
    mark: 'text-fg-subtle',
  },
}

function SourceRow({ source }: { source: DataInventory['sources'][number] }) {
  const t = useTranslations('dataSources')
  const { icon: Icon, badge, label, row, mark } = TREATMENT[source.status]
  return (
    <li className={cn('flex items-start gap-3 rounded-xl border p-4 sm:gap-4', row)}>
      <Icon className={cn('mt-0.5 size-5 shrink-0', mark)} aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <h3 className="font-display text-sm font-semibold sm:text-base">{source.name}</h3>
          <Badge variant={badge}>{t(label)}</Badge>
        </div>
        <p className="text-sm leading-relaxed text-fg-muted">{source.detail}</p>
        <dl className="flex flex-col gap-x-6 gap-y-1 text-xs sm:flex-row sm:flex-wrap">
          <div className="flex gap-1.5">
            <dt className="text-fg-subtle">{t('provider')}</dt>
            <dd className="font-medium text-fg">{source.provider}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-fg-subtle">{t('feeds')}</dt>
            <dd className="font-medium text-fg">{source.feeds}</dd>
          </div>
        </dl>
      </div>
    </li>
  )
}

/** Connected inputs out of the total, as a bar rather than only a sentence. */
function Coverage({ connected, total }: { connected: number; total: number }) {
  const t = useTranslations('dataSources')
  return (
    <div className="flex flex-col gap-2">
      <p className="font-display text-lg font-semibold sm:text-xl">{t('headline', { connected, total })}</p>
      <div
        className="flex gap-1"
        role="img"
        aria-label={t('headline', { connected, total })}
      >
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={cn('h-1.5 flex-1 rounded-full', i < connected ? 'bg-status-ok' : 'bg-border')}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * What the platform is built from.
 *
 * Staff-only, and deliberately blunt: the model currently trains on stand-in data for most of its
 * inputs, and a ministry reading a risk map deserves to find that out here rather than after
 * acting on it.
 */
export function DataSourcesPage() {
  const t = useTranslations('dataSources')
  const { data, error, isPending, isFetching, refetch } = useDataSources()

  return (
    <>
      <div className="bg-contour border-b border-border">
        <div className="mx-auto flex max-w-[1100px] flex-col gap-2 px-4 pt-8 pb-7 sm:px-6 lg:px-8">
          <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-primary uppercase">
            <Database className="size-3.5" aria-hidden /> {t('eyebrow')}
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
        ) : !data || !data.sources.length ? (
          <Card className="mx-auto max-w-2xl text-center">
            <p className="text-sm text-fg-muted">{t('empty')}</p>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardHeading>
                  <CardIcon>
                    <Database />
                  </CardIcon>
                  <div className="min-w-0">
                    <Coverage connected={data.connected} total={data.total} />
                  </div>
                </CardHeading>
              </CardHeader>
              {data.caveat && (
                <p className="flex items-start gap-2.5 rounded-xl border border-status-warn/55 bg-status-warn/10 p-3.5 text-sm leading-relaxed text-fg">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {data.caveat}
                </p>
              )}
              {data.model_version && (
                <CardFooter>
                  <span className="font-mono">
                    {t('modelLine', { version: data.model_version, issued: data.issued_date ?? '—' })}
                  </span>
                </CardFooter>
              )}
            </Card>

            <Card>
              <CardHeader>
                <CardHeading>
                  <div className="min-w-0">
                    <CardTitle>{t('inputsTitle')}</CardTitle>
                    <CardDescription>{t('legend')}</CardDescription>
                  </div>
                </CardHeading>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-3">
                  {data.sources.map((source) => (
                    <SourceRow key={source.key} source={source} />
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
