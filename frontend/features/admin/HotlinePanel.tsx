'use client'

import { useFormatter, useTranslations } from 'next-intl'
import { PhoneCall } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import type { HotlineTurn } from '@agriminds/api-types'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardHeading,
  CardIcon,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { QueryError } from '@/components/ui/query-state'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api/client'

/**
 * What the 977 hotline has been asked, and what went back.
 *
 * The column that matters is `registered`. A question from a number nobody has registered is the
 * clearest demand signal the platform gets — a farmer who found the number and wanted the
 * forecast — and it is the only place that signal is visible.
 *
 * Nothing here claims delivery. Until a carrier is connected every reply is held, and the panel
 * says so rather than letting a row full of answers read as a service that is running.
 */
export function HotlinePanel() {
  const t = useTranslations('hotline')
  const format = useFormatter()
  const traffic = useQuery({
    queryKey: ['admin', 'hotline'],
    queryFn: api.hotlineTraffic,
    staleTime: 30_000,
    retry: false,
  })

  const rows = traffic.data ?? []
  const unregistered = rows.filter((r) => !r.registered).length
  const held = rows.filter((r) => !r.delivered).length

  return (
    <Card className="p-3.5 sm:p-5">
      <CardHeader>
        <CardHeading>
          <CardIcon>
            <PhoneCall />
          </CardIcon>
          <div className="min-w-0">
            <CardTitle>{t('title')}</CardTitle>
            <CardDescription>{t('desc')}</CardDescription>
          </div>
        </CardHeading>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {traffic.isError ? (
          <QueryError
            error={traffic.error}
            onRetry={() => void traffic.refetch()}
            isRetrying={traffic.isFetching}
          />
        ) : traffic.isPending ? (
          <Skeleton className="h-24" />
        ) : rows.length ? (
          <>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge>{t('held', { n: held })}</Badge>
              {unregistered > 0 && <Badge>{t('unregistered', { n: unregistered })}</Badge>}
            </div>
            <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto">
              {rows.map((turn: HotlineTurn) => (
                <li key={turn.id} className="flex flex-col gap-1 rounded-lg border border-border p-2.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
                    <span className="flex items-center gap-2">
                      <code className="font-semibold">{turn.caller}</code>
                      <span className="text-fg-subtle">{turn.channel}</span>
                      {turn.intent && <span className="text-fg-muted">{turn.intent}</span>}
                      {!turn.registered && <Badge>{t('notRegistered')}</Badge>}
                    </span>
                    {turn.at && (
                      <span className="text-fg-subtle">
                        {format.dateTime(new Date(turn.at), 'short')}
                      </span>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed">{turn.reply}</p>
                  {!turn.delivered && turn.note && (
                    <p className="text-[11px] text-fg-subtle">{turn.note}</p>
                  )}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-fg-muted">
            {t('empty')}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
