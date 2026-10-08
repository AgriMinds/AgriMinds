'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3,
  Database,
  Leaf,
  ListChecks,
  Map,
  Sprout,
  Waves,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useTransition } from 'react'
import type { Role } from '@agriminds/api-types'
import { setLocale } from '@/app/actions/locale'
import { Button } from '@/components/ui/button'
import { useFarmerDashboard } from '@/features/farmer/useFarmer'
import { useHealth } from '@/features/health/useHealth'
import { localeName } from '@/features/ministry/useMinistry'
import { useActiveSection } from '@/hooks/useActiveSection'
import { LOCALES, type Locale } from '@/i18n/config'
import { cn } from '@/lib/utils'

type NavItem = { href: string; key: string; icon: LucideIcon }

/** Navigation is driven by role: a farmer never sees the watershed science view. */
export function navForRole(role: Role): NavItem[] {
  if (role === 'farmer') return [{ href: '/farm', key: 'farm', icon: Sprout }]
  return [
    { href: '/ministry', key: 'ministry', icon: Leaf },
    { href: '/watershed', key: 'watershed', icon: Map },
    { href: '/analytics', key: 'analytics', icon: BarChart3 },
    { href: '/data-sources', key: 'dataSources', icon: Database },
  ]
}

/** Anchors on the farm dashboard. A farmer has one page, so its sections are the navigation. */
export const FARM_SECTIONS: { id: string; key: string; icon: LucideIcon }[] = [
  { id: 'advice', key: 'advice', icon: ListChecks },
  { id: 'plots', key: 'plots', icon: Sprout },
  { id: 'season', key: 'season', icon: Waves },
]

const LOCALE_LABEL: Record<Locale, string> = { en: 'English', am: 'አማርኛ', or: 'Afaan Oromoo' }

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

/**
 * Who is signed in.
 *
 * The farmer variant also names their land, because "2 plots · Hulet Ej Enese" tells them at a
 * glance that the figures on screen are about their fields and not somebody else's. It reads the
 * dashboard query for the default lead month, which the farm page requests anyway, so this costs
 * no extra request.
 */
function Identity({ user, detail }: { user: { name: string; role: Role }; detail?: string }) {
  const tr = useTranslations('roles')
  const initials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase()
  return (
    <div className="mx-4 mb-2 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.06] p-3">
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-sage/25 text-xs font-bold text-white"
        aria-hidden
      >
        {initials || '\u2014'}
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-sm font-semibold">{user.name}</span>
        <span className="block truncate text-[11px] text-white/55">{detail ?? tr(user.role)}</span>
      </span>
    </div>
  )
}

function FarmerIdentity({ user }: { user: { name: string; role: Role } }) {
  const t = useTranslations('sidebar')
  const locale = useLocale()
  const { data } = useFarmerDashboard(1)
  const woreda = data?.user.woreda
  const detail = data
    ? [t('plotsCount', { count: data.farms.length }), woreda && localeName(woreda, locale)]
        .filter(Boolean)
        .join(' \u00b7 ')
    : undefined
  return <Identity user={user} detail={detail} />
}

/**
 * Sections of the farm dashboard, with the one in view highlighted.
 *
 * A farmer has a single page, so a list of routes would be one link in an empty column. Jumping
 * to the part they want is the navigation they actually need, and on a phone it saves scrolling
 * past advice they have already read.
 */
function FarmSections({ onNavigate }: { onNavigate: () => void }) {
  const t = useTranslations('nav')
  const ids = FARM_SECTIONS.map((s) => s.id)
  const active = useActiveSection(ids)
  return (
    <>
      <p className="px-3 pt-4 pb-2 text-[10px] font-semibold tracking-[0.18em] text-white/40 uppercase">
        {t('onThisPage')}
      </p>
      <ul className="flex flex-col gap-0.5">
        {FARM_SECTIONS.map(({ id, key, icon: Icon }) => {
          const current = active === id
          return (
            <li key={id}>
              <a
                href={`#${id}`}
                onClick={onNavigate}
                aria-current={current ? 'location' : undefined}
                className={cn(
                  'relative flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-brand-lime',
                  current ? 'bg-white/10 text-white' : 'text-white/65 hover:bg-white/[0.06] hover:text-white',
                )}
              >
                <span
                  className={cn(
                    'absolute top-1/2 left-0 h-5 w-0.75 -translate-y-1/2 rounded-full bg-brand-lime transition-opacity',
                    current ? 'opacity-100' : 'opacity-0',
                  )}
                  aria-hidden
                />
                <Icon className={cn('size-[18px]', current ? 'text-brand-lime' : 'text-white/50')} />
                {t(key)}
              </a>
            </li>
          )
        })}
      </ul>
    </>
  )
}

/**
 * Full-width language choice.
 *
 * The top bar's switcher is a compact three-letter control. For a farmer reading in Amharic or
 * Afaan Oromoo this is the most important setting on the screen, so here it is spelled out in
 * each language's own script at a comfortable touch size.
 */
function LanguageChoice() {
  const t = useTranslations('sidebar')
  const locale = useLocale() as Locale
  const [pending, startTransition] = useTransition()
  return (
    <div className="px-1">
      <p className="px-2 pb-2 text-[10px] font-semibold tracking-[0.18em] text-white/40 uppercase">
        {t('language')}
      </p>
      <div role="radiogroup" aria-label={t('language')} aria-busy={pending} className="flex flex-col gap-1">
        {LOCALES.map((l) => {
          const selected = locale === l
          return (
            <button
              key={l}
              type="button"
              role="radio"
              lang={l}
              aria-checked={selected}
              disabled={pending}
              onClick={() => startTransition(() => setLocale(l))}
              className={cn(
                'flex min-h-11 items-center justify-between rounded-lg border px-3 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-brand-lime disabled:opacity-60',
                selected
                  ? 'border-brand-lime bg-brand-lime font-semibold text-brand-forest-deep'
                  : 'border-white/12 text-white/70 hover:border-white/25 hover:bg-white/[0.06] hover:text-white',
              )}
            >
              {LOCALE_LABEL[l]}
              {selected && <span className="text-xs">✓</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

type Props = { open: boolean; onClose: () => void; user: { name: string; role: Role } }

export function Sidebar({ open, onClose, user }: Props) {
  const t = useTranslations('app')
  const tn = useTranslations('nav')
  const pathname = usePathname()
  const items = navForRole(user.role)
  const farmer = user.role === 'farmer'

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
        aria-label={tn('section')}
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col overflow-y-auto bg-surface-inverse text-white shadow-lg transition-transform duration-300 lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <Link
            href={items[0]?.href ?? '/'}
            onClick={onClose}
            className="flex items-center gap-3 rounded-lg focus-visible:ring-2 focus-visible:ring-brand-lime"
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-brand-lime text-brand-forest-deep shadow-md shadow-black/20">
              <Leaf className="size-5" />
            </span>
            <span className="leading-tight">
              <span className="block font-display text-base font-bold tracking-tight">{t('name')}</span>
              <span className="block text-[10px] font-semibold tracking-[0.2em] text-brand-sage uppercase">
                {t('product')}
              </span>
            </span>
          </Link>
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

        {farmer ? <FarmerIdentity user={user} /> : <Identity user={user} />}

        <nav className="flex-1 px-3 py-2">
          <p className="px-3 pb-2 text-[10px] font-semibold tracking-[0.18em] text-white/40 uppercase">
            {tn('section')}
          </p>
          <ul className="flex flex-col gap-0.5">
            {items.map(({ href, key, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`)
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? 'page' : undefined}
                    onClick={onClose}
                    className={cn(
                      'relative flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-brand-lime',
                      active ? 'bg-white/10 text-white' : 'text-white/65 hover:bg-white/[0.06] hover:text-white',
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-1/2 left-0 h-5 w-0.75 -translate-y-1/2 rounded-full bg-brand-lime transition-opacity',
                        active ? 'opacity-100' : 'opacity-0',
                      )}
                      aria-hidden
                    />
                    <Icon className={cn('size-[18px]', active ? 'text-brand-lime' : 'text-white/50')} />
                    {tn(key)}
                  </Link>
                </li>
              )
            })}
          </ul>
          {farmer && pathname === '/farm' && <FarmSections onNavigate={onClose} />}
        </nav>

        <div className="flex flex-col gap-3 px-4 pb-5">
          {farmer ? <LanguageChoice /> : <ModelCard />}
          <p className="px-1 text-[11px] leading-relaxed text-white/45">{t('workspaceSub')}</p>
        </div>
      </aside>
    </>
  )
}
