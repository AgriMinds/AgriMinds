'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { Role } from '@agriminds/api-types'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'

type Props = { children: React.ReactNode; user: { name: string; role: Role } }

export function Shell({ children, user }: Props) {
  const [navOpen, setNavOpen] = useState(false)
  const t = useTranslations('footer')
  return (
    <div className="min-h-svh">
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} user={user} />
      <div className="flex min-h-svh flex-col lg:pl-[264px]">
        <TopBar onOpenNav={() => setNavOpen(true)} user={user} />
        <main id="main" tabIndex={-1} className="flex-1 outline-none">
          {children}
        </main>
        <footer className="border-t border-border px-4 py-6 text-center text-xs text-fg-subtle sm:px-6 lg:px-8">
          <p>{t('affiliation')}</p>
          <p className="mt-1">
            {t('telemetry')} <span className="mx-2 text-border-strong">|</span> {t('framework')}
          </p>
        </footer>
      </div>
    </div>
  )
}
