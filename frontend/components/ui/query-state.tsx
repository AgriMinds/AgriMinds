'use client'

import { AlertTriangle, RefreshCw, ServerOff } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { ApiError } from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Props = {
  error: unknown
  onRetry?: () => void
  isRetrying?: boolean
  className?: string
}

/** Shared error state for every query: distinguishes "model unavailable" (503) from transport errors. */
export function QueryError({ error, onRetry, isRetrying, className }: Props) {
  const t = useTranslations('common')
  const unavailable = error instanceof ApiError && error.isUnavailable
  const message = error instanceof Error ? error.message : String(error)
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-surface-sunken/60 p-6 text-center',
        className,
      )}
    >
      <div className="flex size-10 items-center justify-center rounded-full bg-status-bad/15 text-status-bad">
        {unavailable ? <ServerOff className="size-5" /> : <AlertTriangle className="size-5" />}
      </div>
      <div>
        <p className="text-sm font-bold">{unavailable ? t('unavailableTitle') : t('errorTitle')}</p>
        <p className="mt-1 max-w-prose text-xs text-fg-muted">
          {unavailable ? t('unavailableBody') : message}
        </p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} disabled={isRetrying}>
          <RefreshCw className={cn(isRetrying && 'animate-spin')} /> {t('retry')}
        </Button>
      )}
    </div>
  )
}
