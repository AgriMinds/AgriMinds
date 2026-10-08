'use client'

import { AlertTriangle, RefreshCw, ServerOff } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { ApiError } from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Props = { error: unknown; onRetry?: () => void; isRetrying?: boolean; className?: string }

/** Shared error state for every query: distinguishes "model unavailable" (503) from transport errors. */
export function QueryError({ error, onRetry, isRetrying, className }: Props) {
  const t = useTranslations('common')
  const unavailable = error instanceof ApiError && error.isUnavailable
  const message = error instanceof Error ? error.message : String(error)
  return (
    <div
      role="alert"
      className={cn('flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border-strong bg-surface-sunken/50 p-8 text-center', className)}
    >
      <span className="flex size-11 items-center justify-center rounded-xl bg-status-bad/12 text-status-bad" aria-hidden>
        {unavailable ? <ServerOff className="size-5" /> : <AlertTriangle className="size-5" />}
      </span>
      <div>
        <p className="font-display text-sm font-semibold">{unavailable ? t('unavailableTitle') : t('errorTitle')}</p>
        <p className="mt-1 max-w-prose text-xs leading-relaxed text-fg-muted">{unavailable ? t('unavailableBody') : message}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} disabled={isRetrying}>
          <RefreshCw className={cn(isRetrying && 'animate-spin')} /> {t('retry')}
        </Button>
      )}
    </div>
  )
}
