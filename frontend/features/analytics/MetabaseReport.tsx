'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, Lock, RefreshCw } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { EmbedConfig } from '@agriminds/api-types'
import { Badge } from '@/components/ui/badge'

/** Renew this long before the URL dies, so a slow network still beats the deadline. */
const RENEW_LEAD_MS = 3 * 60_000
/**
 * Safety net for an `expires_at` that cannot be real — a wrong clock, or a missing value. The
 * server signs for an hour, so a legitimate schedule always lands well inside this.
 */
const MAX_TIMER_MS = 2 * 60 * 60_000

type Props = {
  config: EmbedConfig
  /** Asks the server to sign a new URL. Resolves when `config` has been replaced. */
  onRenew: () => void
  isRenewing: boolean
}

export function millisecondsUntilRenewal(expiresAt: string, now: number = Date.now()): number {
  const remaining = new Date(expiresAt).getTime() - now - RENEW_LEAD_MS
  if (!Number.isFinite(remaining)) return MAX_TIMER_MS
  // A URL already inside its lead window is renewed on the next tick rather than immediately,
  // which keeps the effect from re-entering during the same render pass.
  return Math.min(Math.max(remaining, 1_000), MAX_TIMER_MS)
}

/**
 * The embedded dashboard.
 *
 * Metabase's static embedding puts the whole authorisation in the signed URL, so there is no
 * client library and no token to push into a running frame: renewing means a new `src`, which
 * reloads the iframe. That is why the server signs for an hour rather than minutes — a viewer
 * studying a chart should not be interrupted every few minutes to refresh a credential they
 * cannot see.
 *
 * The scope line is not decoration. When a locked parameter narrows a development agent to their
 * own woreda, the viewer should be able to tell at a glance that the figures are partial.
 */
export function MetabaseReport({ config, onRenew, isRenewing }: Props) {
  const t = useTranslations('analytics')
  const src = config.embed_url
  // Which URL has finished loading, rather than a boolean reset on every change: a renewal
  // swaps the src, and the placeholder must come back for the new frame without an effect
  // reaching in to clear a flag.
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null)
  const loaded = loadedUrl === src

  // Renew on the URL's own schedule, not a fixed interval: the server decides how long it lives.
  useEffect(() => {
    const timer = window.setTimeout(onRenew, millisecondsUntilRenewal(config.expires_at))
    return () => window.clearTimeout(timer)
  }, [config.expires_at, onRenew])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex flex-wrap items-center gap-2 text-sm text-fg-muted">
          <span>{t('showing', { scope: config.scope })}</span>
          {config.scoped && (
            <Badge variant="outline" className="gap-1">
              <Lock className="size-3" aria-hidden /> {t('rlsApplied')}
            </Badge>
          )}
        </p>
        <span className="flex items-center gap-3">
          {isRenewing && (
            <span className="flex items-center gap-1.5 text-xs text-fg-subtle" role="status">
              <RefreshCw className="size-3 animate-spin" aria-hidden /> {t('renewing')}
            </span>
          )}
          <a
            href={src}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-xs font-medium text-fg-muted underline-offset-2 hover:text-fg hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t('openFullScreen')} <ExternalLink className="size-3" aria-hidden />
          </a>
        </span>
      </div>

      {/* The frame keeps a light surface in both themes. Metabase's static embed ignores the
          theme options in the URL fragment (tested against v0.50), so the dashboard renders
          light whatever the page does; giving its container a deliberate light sheet reads as a
          printed report rather than as an element that failed to follow the theme. */}
      <div className="relative h-[70vh] min-h-[420px] w-full overflow-hidden rounded-2xl border border-border bg-white p-1 shadow-sm">
        {!loaded && (
          <div
            className="absolute inset-0 animate-pulse bg-surface-sunken"
            role="status"
            aria-label={t('loadingReport')}
          />
        )}
        <iframe
          key={src}
          src={src}
          title={t('reportTitle')}
          onLoad={() => setLoadedUrl(src)}
          className="size-full rounded-xl border-0"
          // The dashboard is read-only and same-purpose; it needs no camera, no payment, no
          // access to the parent. Allow only what a chart actually uses.
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          allow="fullscreen"
          referrerPolicy="no-referrer"
        />
      </div>
    </div>
  )
}
