'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Lock, RefreshCw } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { models, type Report } from 'powerbi-client'
import { PowerBIEmbed } from 'powerbi-client-react'
import type { EmbedConfig } from '@agriminds/api-types'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

/** Refresh this long before the token dies, so a slow network still beats the deadline. */
const RENEW_LEAD_MS = 2 * 60_000
/**
 * Safety net for an absurd `expires_at` — a wrong clock, or a value that never arrives. Power BI
 * caps embed tokens at sixty minutes, so a legitimate schedule always lands inside this; the
 * clamp only catches values that could not be real.
 */
const MAX_TIMER_MS = 60 * 60_000

type Props = {
  config: EmbedConfig
  /** Asks the server for a new token. Resolves when `config` has been replaced. */
  onRenew: () => void
  isRenewing: boolean
}

export function millisecondsUntilRenewal(expiresAt: string, now: number = Date.now()): number {
  const remaining = new Date(expiresAt).getTime() - now - RENEW_LEAD_MS
  if (!Number.isFinite(remaining)) return MAX_TIMER_MS
  // A token already inside its lead window is renewed on the next tick rather than immediately,
  // which keeps the effect from re-entering during the same render pass.
  return Math.min(Math.max(remaining, 1_000), MAX_TIMER_MS)
}

/**
 * The embedded report.
 *
 * Two things matter here. The `embedConfig` object handed to `PowerBIEmbed` is frozen after the
 * first render: changing it tears the iframe down and the viewer loses their place, their
 * filters and their scroll position. So a renewed token is pushed into the live report with
 * `setAccessToken` instead. And the renewal is scheduled from the token's own `expires_at`
 * rather than a fixed interval, because the server decides how long a token lives.
 */
export function PowerBiReport({ config, onRenew, isRenewing }: Props) {
  const t = useTranslations('analytics')
  const reportRef = useRef<Report | null>(null)
  const [embedError, setEmbedError] = useState<string | null>(null)

  // Captured once. Later tokens arrive through setAccessToken, never through this object.
  const [initialConfig] = useState(() => ({
    type: 'report' as const,
    id: config.report_id,
    embedUrl: config.embed_url,
    accessToken: config.access_token,
    tokenType: models.TokenType.Embed,
    settings: {
      // The app already provides navigation and filtering; the report should not duplicate them.
      panes: {
        filters: { visible: false, expanded: false },
        pageNavigation: { visible: false },
      },
      // Lets the surrounding surface show through, so the frame follows the app's theme.
      background: models.BackgroundType.Transparent,
      layoutType: models.LayoutType.Custom,
      customLayout: { displayOption: models.DisplayOption.FitToWidth },
    },
  }))

  // Push a renewed token into the running report rather than remounting it.
  useEffect(() => {
    const report = reportRef.current
    if (!report || config.access_token === initialConfig.accessToken) return
    void report.setAccessToken(config.access_token).catch(() => {
      setEmbedError(t('tokenRenewFailed'))
    })
  }, [config.access_token, initialConfig.accessToken, t])

  // Renew on the token's own schedule.
  useEffect(() => {
    const timer = window.setTimeout(onRenew, millisecondsUntilRenewal(config.expires_at))
    return () => window.clearTimeout(timer)
  }, [config.expires_at, onRenew])

  const handleEmbedded = useCallback((embedObject: unknown) => {
    reportRef.current = embedObject as Report
  }, [])

  const handlers = new Map<string, (event?: { detail?: unknown }) => void>([
    ['loaded', () => setEmbedError(null)],
    ['rendered', () => setEmbedError(null)],
    ['error', () => setEmbedError(t('embedFailed'))],
  ])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex flex-wrap items-center gap-2 text-sm text-fg-muted">
          <span>{t('showing', { scope: config.scope })}</span>
          {config.rls_applied && (
            <Badge variant="outline" className="gap-1">
              <Lock className="size-3" aria-hidden /> {t('rlsApplied')}
            </Badge>
          )}
        </p>
        {isRenewing && (
          <span className="flex items-center gap-1.5 text-xs text-fg-subtle" role="status">
            <RefreshCw className="size-3 animate-spin" aria-hidden /> {t('renewing')}
          </span>
        )}
      </div>

      {embedError && (
        <p role="alert" className="rounded-lg border border-status-bad/40 bg-status-bad/10 px-3 py-2 text-sm">
          {embedError}
        </p>
      )}

      <PowerBIEmbed
        embedConfig={initialConfig}
        eventHandlers={handlers}
        getEmbeddedComponent={handleEmbedded}
        cssClassName={cn(
          'h-[70vh] min-h-[420px] w-full overflow-hidden rounded-2xl border border-border bg-surface-raised',
          '[&>iframe]:border-0',
        )}
      />
    </div>
  )
}
