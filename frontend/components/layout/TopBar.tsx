'use client'

import { MapPin, Menu, Sprout, Wifi, WifiOff } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { Button } from '@/components/ui/button'
import { useHealth, type ConnectionStatus } from '@/features/health/useHealth'
import { cn } from '@/lib/utils'

const DOT: Record<ConnectionStatus, string> = {
  healthy: 'bg-status-ok animate-pulse',
  degraded: 'bg-status-warn',
  unavailable: 'bg-status-bad',
  offline: 'bg-status-bad',
  loading: 'bg-status-warn animate-bounce',
}

export function HealthChip() {
  const t = useTranslations('status')
  const { status, data } = useHealth()
  const label = t(status)
  const detail = data?.model.model_version ? `${label} · ${data.model.model_version}` : label
  return (
    <div
      role="status"
      aria-label={t('ariaLabel')}
      title={detail}
      className="flex items-center gap-1.5 rounded-full border border-border bg-surface-sunken/80 px-2 py-1 text-[11px] font-semibold sm:px-3 sm:text-xs"
    >
      <span className={cn('size-2 shrink-0 rounded-full sm:size-2.5', DOT[status])} />
      <span className="hidden text-fg-muted md:inline">{label}</span>
      <span className="md:hidden">
        {status === 'healthy' ? (
          <Wifi className="size-3 text-status-ok" />
        ) : (
          <WifiOff className="size-3 text-status-bad" />
        )}
      </span>
    </div>
  )
}

export function TopBar({ onOpenNav }: { onOpenNav: () => void }) {
  const t = useTranslations('app')
  return (
    <header className="sticky top-0 z-30 w-full border-b border-border bg-surface-raised/90 shadow-xs backdrop-blur-md">
      <div className="mx-auto flex max-w-[1640px] items-center justify-between gap-3 px-3 py-2.5 sm:px-6 sm:py-3.5 lg:px-8">
        <div className="flex min-w-0 items-center gap-2.5">
          <Button
            variant="outline"
            size="icon-sm"
            className="lg:hidden"
            aria-label={t('openNavigation')}
            onClick={onOpenNav}
          >
            <Menu />
          </Button>
          <div className="hidden size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-fg shadow-md sm:flex">
            <Sprout className="size-5" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-base font-black tracking-tight sm:text-xl">{t('title')}</h1>
            <p className="hidden items-center gap-1 truncate text-xs text-fg-muted sm:flex">
              <MapPin className="size-3 shrink-0 text-primary" /> {t('subtitle')}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <HealthChip />
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  )
}
