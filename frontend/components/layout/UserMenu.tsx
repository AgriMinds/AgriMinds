'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, LogOut, UserRound } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { Role } from '@agriminds/api-types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { authApi } from '@/lib/api/client'
import { cn } from '@/lib/utils'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return (parts[0]![0]! + (parts.length > 1 ? parts.at(-1)![0]! : '')).toUpperCase()
}

export function UserMenu({ name, role }: { name: string; role: Role }) {
  const t = useTranslations('account')
  const tr = useTranslations('roles')
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function signOut() {
    setBusy(true)
    await authApi.logout()
    router.replace('/login')
    router.refresh()
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-9 items-center gap-2 rounded-lg border border-border bg-surface-raised pr-2 pl-1.5 text-xs font-semibold text-fg shadow-xs transition-colors hover:bg-surface-sunken focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <span
          className="flex size-6 items-center justify-center rounded-md bg-primary text-[10px] font-bold text-primary-fg"
          aria-hidden
        >
          {initials(name)}
        </span>
        <span className="hidden max-w-[11rem] truncate sm:inline">{name}</span>
        <ChevronDown className={cn('size-3.5 text-fg-muted transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={t('menu')}
          className="absolute right-0 z-50 mt-2 w-64 rounded-xl border border-border bg-surface-raised p-3 shadow-lg"
        >
          <div className="flex items-start gap-2.5 border-b border-border pb-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-sunken text-fg-muted">
              <UserRound className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{name}</p>
              <Badge variant="outline" size="sm" className="mt-1">
                {tr(role)}
              </Badge>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            role="menuitem"
            className="mt-2 w-full justify-start"
            disabled={busy}
            onClick={signOut}
          >
            <LogOut /> {busy ? t('signingOut') : t('signOut')}
          </Button>
        </div>
      )}
    </div>
  )
}
