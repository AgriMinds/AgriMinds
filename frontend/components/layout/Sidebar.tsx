'use client'

import { Activity, FileText, LayoutDashboard, Leaf, Map, Sprout, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { useHealth } from '@/features/health/useHealth'
import { cn } from '@/lib/utils'

export const SECTION_IDS = ['overview', 'drought', 'advisories', 'enso', 'reports'] as const
export type SectionId = (typeof SECTION_IDS)[number]

const NAV: { id: SectionId; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'overview', icon: LayoutDashboard },
  { id: 'drought', icon: Map },
  { id: 'advisories', icon: Sprout },
  { id: 'enso', icon: Activity },
  { id: 'reports', icon: FileText },
]

type Props = { open: boolean; onClose: () => void; active: SectionId }

function ModelCard() {
  const t = useTranslations('app.model')
  const { data, status } = useHealth()
  const model = data?.model
  const rows: Array<[string, string]> = [
    [t('version'), model?.model_version ?? '—'],
    [t('data'), model?.data_source ? t(model.data_source === 'real' ? 'real' : 'synthetic') : '—'],
    [t('issued'), model?.issued_date ?? '—'],
  ]
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.06] p-3.5">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-semibold tracking-[0.16em] text-brand-sage uppercase">{t('title')}</span>
        <span
          className={cn(
            'size-2 rounded-full',
            status === 'healthy' ? 'bg-status-ok' : status === 'degraded' ? 'bg-status-warn' : 'bg-status-bad',
          )}
          aria-hidden
        />
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-white/50">{k}</dt>
            <dd className="truncate font-mono text-white/85">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export function Sidebar({ open, onClose, active }: Props) {
  const t = useTranslations('app')
  return (
    <>
      {open && (
        <button
          type="button"
          aria-label={t('closeNavigation')}
          className="fixed inset-0 z-40 bg-brand-forest-deep/60 backdrop-blur-[2px] lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        aria-label={t('nav.section')}
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col bg-surface-inverse text-white shadow-lg transition-transform duration-300 lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <a href="#main" className="flex items-center gap-3 rounded-lg focus-visible:ring-2 focus-visible:ring-brand-lime">
            <span className="flex size-10 items-center justify-center rounded-xl bg-brand-lime text-brand-forest-deep shadow-md shadow-black/20">
              <Leaf className="size-5" />
            </span>
            <span className="leading-tight">
              <span className="block font-display text-base font-bold tracking-tight">{t('name')}</span>
              <span className="block text-[10px] font-semibold tracking-[0.2em] text-brand-sage uppercase">
                {t('product')}
              </span>
            </span>
          </a>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-white/70 hover:bg-white/10 hover:text-white lg:hidden"
            aria-label={t('closeNavigation')}
            onClick={onClose}
          >
            <X />
          </Button>
        </div>

        <nav className="flex-1 px-3 py-2">
          <p className="px-3 pb-2 text-[10px] font-semibold tracking-[0.18em] text-white/40 uppercase">
            {t('nav.section')}
          </p>
          <ul className="flex flex-col gap-0.5">
            {NAV.map(({ id, icon: Icon }) => {
              const isActive = active === id
              return (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    aria-current={isActive ? 'location' : undefined}
                    onClick={onClose}
                    className={cn(
                      'relative flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-brand-lime',
                      isActive ? 'bg-white/10 text-white' : 'text-white/65 hover:bg-white/[0.06] hover:text-white',
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-1/2 left-0 h-5 w-0.75 -translate-y-1/2 rounded-full bg-brand-lime transition-opacity',
                        isActive ? 'opacity-100' : 'opacity-0',
                      )}
                      aria-hidden
                    />
                    <Icon className={cn('size-[18px]', isActive ? 'text-brand-lime' : 'text-white/50')} />
                    {t(`nav.${id}`)}
                  </a>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="flex flex-col gap-3 px-4 pb-5">
          <ModelCard />
          <p className="px-1 text-[11px] leading-relaxed text-white/45">{t('workspaceSub')}</p>
        </div>
      </aside>
    </>
  )
}
