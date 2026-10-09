'use client'

import { useCallback } from 'react'
import dynamic from 'next/dynamic'
import { BarChart3 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { Role } from '@agriminds/api-types'
import { QueryError } from '@/components/ui/query-state'
import { Skeleton } from '@/components/ui/skeleton'
import { NotConfigured } from '@/features/analytics/NotConfigured'
import { useEmbedUrl, useMetabaseStatus } from '@/features/analytics/useAnalytics'

// The frame is only meaningful in a browser, and keeping it out of the server bundle means an
// unconfigured deployment ships none of it.
const MetabaseReport = dynamic(
  () => import('@/features/analytics/MetabaseReport').then((m) => m.MetabaseReport),
  { ssr: false, loading: () => <Skeleton className="h-[70vh] min-h-[420px] rounded-2xl" /> },
)

/**
 * Deep analysis for ministry staff.
 *
 * This sits beside the native dashboards rather than replacing them: those are trilingual and
 * work on a cheap phone, which is what a development agent in a kebele actually has. The
 * embedded dashboard is for an analyst at a desk who wants to slice the data themselves.
 */
export function AnalyticsPage({ role }: { role: Role }) {
  const t = useTranslations('analytics')
  const status = useMetabaseStatus()
  const configured = status.data?.configured === true
  const embed = useEmbedUrl(configured)
  const renew = useCallback(() => void embed.refetch(), [embed])

  return (
    <>
      <div className="bg-contour border-b border-border">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-2 px-4 pt-8 pb-7 sm:px-6 lg:px-8">
          <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-primary uppercase">
            <BarChart3 className="size-3.5" aria-hidden /> {t('eyebrow')}
          </p>
          <h1 className="font-display text-display font-bold">{t('title')}</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-fg-muted sm:text-base">{t('intro')}</p>
        </div>
      </div>

      <div className="mx-auto flex max-w-[1600px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {status.isPending ? (
          <Skeleton className="h-64 rounded-2xl" />
        ) : status.error ? (
          <QueryError
            error={status.error}
            onRetry={() => void status.refetch()}
            isRetrying={status.isFetching}
          />
        ) : !configured ? (
          <NotConfigured status={status.data!} role={role} />
        ) : embed.isPending ? (
          <Skeleton className="h-[70vh] min-h-[420px] rounded-2xl" />
        ) : embed.error || !embed.data ? (
          <QueryError
            error={embed.error}
            onRetry={() => void embed.refetch()}
            isRetrying={embed.isFetching}
          />
        ) : (
          <MetabaseReport config={embed.data} onRenew={renew} isRenewing={embed.isFetching} />
        )}
      </div>
    </>
  )
}
