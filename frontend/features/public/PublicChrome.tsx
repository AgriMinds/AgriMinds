import Image from 'next/image'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { ArrowRight } from 'lucide-react'
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'
import { LinkButton } from '@/features/public/LinkButton'
import { getSession } from '@/lib/server/session'

const NAV = [
  { href: '/how-it-works', key: 'howItWorks' },
  { href: '/about', key: 'about' },
] as const

/**
 * The header a visitor meets before they have an account.
 *
 * It knows whether they are signed in, because bouncing somebody who already has a workspace back
 * to a sign-in form is the most common way a landing page wastes a returning user's time.
 */
export async function PublicHeader() {
  const t = await getTranslations('site')
  const session = await getSession()

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-surface/80 backdrop-blur-md supports-[backdrop-filter]:bg-surface/60">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex min-w-0 items-center gap-2.5 rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
          <Image src="/icon.png" alt="" width={32} height={32} className="size-8 rounded-lg" />
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="font-display text-sm font-bold tracking-tight">AgriMinds</span>
            <span className="truncate text-[10px] tracking-wider text-fg-subtle uppercase">AI-DREWS</span>
          </span>
        </Link>

        <nav aria-label={t('nav')} className="ml-4 hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-fg-muted transition-colors hover:bg-surface-sunken hover:text-fg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {t(`nav_${item.key}`)}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden sm:block">
            <LanguageSwitcher />
          </div>
          {session ? (
            <LinkButton href="/farm" size="sm">
                {t('toWorkspace')} <ArrowRight className="size-3.5" />
              </LinkButton>
          ) : (
            <>
              <LinkButton href="/login" size="sm" variant="ghost" className="hidden sm:inline-flex">{t('signIn')}</LinkButton>
              <LinkButton href="/request-access" size="sm">{t('requestAccess')}</LinkButton>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

export async function PublicFooter() {
  const t = await getTranslations('site')
  return (
    <footer className="border-t border-border bg-surface-sunken">
      <div className="mx-auto grid max-w-[1280px] gap-8 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr] lg:px-8">
        <div className="flex flex-col gap-3">
          <span className="flex items-center gap-2.5">
            <Image src="/icon.png" alt="" width={28} height={28} className="size-7 rounded-md" />
            <span className="font-display text-sm font-bold">AgriMinds AI-DREWS</span>
          </span>
          <p className="max-w-sm text-sm leading-relaxed text-fg-muted">{t('footerBlurb')}</p>
          <p className="text-xs text-fg-subtle">{t('institutions')}</p>
        </div>

        <nav aria-label={t('nav')} className="flex flex-col gap-2 text-sm">
          <span className="text-xs font-semibold tracking-wider text-fg-subtle uppercase">
            {t('footerExplore')}
          </span>
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="text-fg-muted hover:text-fg hover:underline">
              {t(`nav_${item.key}`)}
            </Link>
          ))}
          <Link href="/request-access" className="text-fg-muted hover:text-fg hover:underline">
            {t('requestAccess')}
          </Link>
          <Link href="/login" className="text-fg-muted hover:text-fg hover:underline">
            {t('signIn')}
          </Link>
        </nav>

        <div className="flex flex-col gap-2 text-sm">
          <span className="text-xs font-semibold tracking-wider text-fg-subtle uppercase">
            {t('footerBuiltOn')}
          </span>
          <span className="text-fg-muted">CHIRPS · ERA5 · NOAA ONI · CSA</span>
          <span className="text-fg-muted">PyTorch · XGBoost</span>
        </div>
      </div>
      <div className="border-t border-border/60 px-4 py-5 text-center text-xs text-fg-subtle sm:px-6 lg:px-8">
        {t('copyright', { year: new Date().getFullYear() })}
      </div>
    </footer>
  )
}
