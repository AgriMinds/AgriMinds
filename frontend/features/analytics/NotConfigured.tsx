'use client'

import Link from 'next/link'
import { ArrowRight, BarChart3, Check, Database, Leaf, Map, Table2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { MetabaseStatus, Role } from '@agriminds/api-types'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardHeading, CardIcon, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAnalyticsConnection } from '@/features/analytics/useAnalytics'
import { cn } from '@/lib/utils'

/**
 * What this page shows before the analytics dashboard has been set up, which is the state a
 * fresh deployment starts in.
 *
 * It is written to be useful rather than apologetic: the native dashboards already answer the
 * day-to-day questions, and an analyst who wants their own view can point any SQL tool at the
 * read-only schema today. The raw list of unset variables goes only to an administrator; a
 * minister is told what it means, not which environment variables are blank.
 */
export function NotConfigured({ status, role }: { status: MetabaseStatus; role: Role }) {
  const t = useTranslations('analytics')
  const isAdmin = role === 'admin'
  const connection = useAnalyticsConnection(isAdmin)

  // An empty state is a focused block, not a banner: stretched across a 1600px page it reads as
  // an unfinished screen. The column is held to a comfortable reading width and centred, and an
  // administrator gets a wider one because the connection card carries a table of view names.
  return (
    <div className={cn('mx-auto flex w-full flex-col gap-6', isAdmin ? 'max-w-4xl' : 'max-w-2xl')}>
      <Card>
        <CardHeader>
          <CardHeading>
            <CardIcon>
              <BarChart3 />
            </CardIcon>
            <div className="min-w-0">
              <CardTitle>{t('notConfiguredTitle')}</CardTitle>
              <CardDescription>{t('notConfiguredLead')}</CardDescription>
            </div>
          </CardHeading>
        </CardHeader>
        <CardContent>
          {/* Lead with what the tab is for. A reader who has never seen it needs to know what
              it will show before being told it is not switched on. */}
          <div>
            <p className="mb-2 text-xs font-semibold tracking-wider text-fg-muted uppercase">
              {t('willShowTitle')}
            </p>
            <ul className="flex max-w-prose flex-col gap-1.5">
              {(['willShowFarms', 'willShowAdvisories', 'willShowHistory', 'willShowCrops'] as const).map(
                (key) => (
                  <li key={key} className="flex items-start gap-2 text-sm leading-relaxed">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                    {t(key)}
                  </li>
                ),
              )}
            </ul>
          </div>

          <p className="max-w-prose text-sm leading-relaxed text-fg-muted">{t('notConfiguredNative')}</p>

          {/* The sentence above names two dashboards; these make it a route rather than a
              dead end, which is the whole of what this page can usefully offer a minister. */}
          <div>
            <p className="mb-2 text-xs font-semibold tracking-wider text-fg-muted uppercase">
              {t('whereInstead')}
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href="/ministry" className={buttonVariants({ variant: 'outline' })}>
                <Leaf /> {t('openMinistry')} <ArrowRight className="opacity-60" />
              </Link>
              <Link href="/watershed" className={buttonVariants({ variant: 'outline' })}>
                <Map /> {t('openWatershed')} <ArrowRight className="opacity-60" />
              </Link>
            </div>
          </div>
          {isAdmin && (
            <div className="rounded-xl border border-dashed border-border-strong bg-surface-sunken/50 p-3.5">
              <p className="text-sm font-semibold">{t('adminSetupTitle')}</p>
              <p className="mt-1 text-sm leading-relaxed text-fg-muted">{t('adminSetupBody')}</p>
              {status.reason && (
                <p className="mt-2 font-mono text-[11px] break-words text-fg-subtle" data-testid="metabase-reason">
                  {status.reason}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {isAdmin && (
        <Card data-testid="analytics-connection">
          <CardHeader>
            <CardHeading>
              <CardIcon>
                <Database />
              </CardIcon>
              <div className="min-w-0">
                <CardTitle>{t('connectionTitle')}</CardTitle>
                <CardDescription>{t('connectionLead')}</CardDescription>
              </div>
            </CardHeading>
          </CardHeader>
          <CardContent>
            {connection.isPending ? (
              <Skeleton className="h-28 rounded-xl" />
            ) : connection.data ? (
              <>
                <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
                  {(
                    [
                      [t('server'), connection.data.server],
                      [t('database'), connection.data.database],
                      [t('schema'), connection.data.schema],
                      [t('readOnlyRole'), connection.data.read_only_role],
                    ] as const
                  ).map(([label, value]) => (
                    <div key={label} className="contents">
                      <dt className="text-fg-muted">{label}</dt>
                      <dd className="font-mono text-[13px] break-all">{value}</dd>
                    </div>
                  ))}
                </dl>
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wider text-fg-muted uppercase">
                    <Table2 className="size-3.5" aria-hidden /> {t('viewsAvailable')}
                  </p>
                  <ul className="flex flex-wrap gap-1.5">
                    {connection.data.views.map((view) => (
                      <li
                        key={view}
                        className="rounded-md border border-border bg-surface-sunken px-2 py-1 font-mono text-[11px]"
                      >
                        {view}
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="max-w-prose text-sm leading-relaxed text-fg-muted">{connection.data.note}</p>
              </>
            ) : (
              <p className="text-sm text-fg-muted">{t('connectionUnavailable')}</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
