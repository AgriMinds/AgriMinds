'use client'

import { Leaf, MapPin, Menu } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { UserMenu } from '@/components/layout/UserMenu'
import { Button } from '@/components/ui/button'
import type { Role } from '@agriminds/api-types'
import { useHealth, type ConnectionStatus } from '@/features/health/useHealth'
import { cn } from '@/lib/utils'

const DOT: Record<ConnectionStatus, string> = {
  healthy: 'bg-status-ok',
  degraded: 'bg-status-warn',
  unavailable: 'bg-status-bad',
  offline: 'bg-status-bad',
  loading: 'bg-fg-subtle animate-pulse',
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
      className="flex h-9 items-center gap-2 rounded-lg border border-border bg-surface-raised px-2.5 text-xs font-medium text-fg-muted shadow-xs"
    >
      <span className="relative flex size-2.5">
        {status === 'healthy' && (
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-status-ok opacity-60" />
        )}
        <span className={cn('relative inline-flex size-2.5 rounded-full', DOT[status])} />
      </span>
      <span className="hidden md:inline">{label}</span>
    </div>
  )
}

type TopBarProps = { onOpenNav: () => void; user: { name: string; role: Role } }

export function TopBar({ onOpenNav, user }: TopBarProps) {
  const t = useTranslations('app')
  return (
    <header className="sticky top-0 z-30 w-full border-b border-border bg-surface/85 backdrop-blur-md supports-[backdrop-filter]:bg-surface/70">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="outline" size="icon-sm" className="lg:hidden" aria-label={t('openNavigation')} onClick={onOpenNav}>
            <Menu />
          </Button>
          <span className="flex min-w-0 items-center gap-2 truncate font-display text-sm font-bold tracking-tight lg:hidden">
            <Leaf className="size-4 text-primary" /> {t('title')}
          </span>
          <p className="hidden min-w-0 items-center gap-1.5 truncate text-sm text-fg-muted lg:flex">
            <MapPin className="size-3.5 shrink-0 text-primary" /> {t('subtitle')}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden sm:inline-flex">
            <HealthChip />
          </span>
          <ThemeToggle />
          <span className="hidden md:inline-flex">
            <LanguageSwitcher />
          </span>
          <UserMenu name={user.name} role={user.role} />
        </div>
      </div>
    </header>
  )
}
