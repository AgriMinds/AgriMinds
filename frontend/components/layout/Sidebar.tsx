'use client'

import { CloudSun, FileText, LayoutDashboard, Leaf, ShieldCheck, Sprout, Waves, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type SectionId = 'overview' | 'drought' | 'advisories' | 'enso' | 'reports'

const NAV: { id: SectionId; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'overview', icon: LayoutDashboard },
  { id: 'drought', icon: CloudSun },
  { id: 'advisories', icon: Sprout },
  { id: 'enso', icon: Waves },
  { id: 'reports', icon: FileText },
]

type Props = { open: boolean; onClose: () => void; active: SectionId; onNavigate: (id: SectionId) => void }

export function Sidebar({ open, onClose, active, onNavigate }: Props) {
  const t = useTranslations('app')
  return (
    <>
      {open && (
        <button
          type="button"
          aria-label={t('closeNavigation')}
          className="fixed inset-0 z-40 bg-brand-forest-deep/50 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        aria-label={t('nav.section')}
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col bg-brand-forest text-white shadow-2xl transition-transform duration-300 lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-5">
          <a
            href="#main"
            className="flex items-center gap-3 rounded-lg focus-visible:ring-2 focus-visible:ring-brand-lime"
          >
            <div className="flex size-10 items-center justify-center rounded-xl bg-brand-lime text-brand-forest">
              <Leaf className="size-5" />
            </div>
            <div>
              <div className="font-black tracking-tight">{t('name')}</div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-sage">
                {t('product')}
              </div>
            </div>
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

        <div className="mx-4 mt-5 rounded-2xl border border-white/10 bg-white/[0.07] p-3">
          <div className="mb-1.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-brand-sage">
            <ShieldCheck className="size-3.5" /> {t('workspace')}
          </div>
          <p className="text-xs text-white/60">{t('workspaceSub')}</p>
        </div>

        <nav className="flex-1 px-4 py-6">
          <p className="px-3 pb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
            {t('nav.section')}
          </p>
          <ul className="flex flex-col gap-1">
            {NAV.map(({ id, icon: Icon }) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  aria-current={active === id ? 'page' : undefined}
                  onClick={() => {
                    onNavigate(id)
                    onClose()
                  }}
                  className={cn(
                    'flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand-lime',
                    active === id
                      ? 'bg-brand-lime text-brand-forest shadow-lg shadow-black/10'
                      : 'text-white/70 hover:bg-white/10 hover:text-white',
                  )}
                >
                  <Icon className="size-[18px]" />
                  {t(`nav.${id}`)}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-t border-white/10 p-4 text-[11px] leading-relaxed text-white/50">
          {t('tagline')}
        </div>
      </aside>
    </>
  )
}
