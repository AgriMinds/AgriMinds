'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Sidebar, type SectionId } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'

export function Shell({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(false)
  const [active, setActive] = useState<SectionId>('overview')
  const t = useTranslations('footer')
  return (
    <div className="min-h-svh">
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} active={active} onNavigate={setActive} />
      <div className="lg:pl-[272px]">
        <TopBar onOpenNav={() => setNavOpen(true)} />
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1640px] px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
        <footer className="border-t border-border bg-surface-raised px-4 py-5 text-center text-xs text-fg-subtle sm:px-6 lg:px-8">
          <p>{t('affiliation')}</p>
          <p className="mt-1">
            {t('telemetry')} <span className="mx-2">•</span> {t('framework')}
          </p>
        </footer>
      </div>
    </div>
  )
}
