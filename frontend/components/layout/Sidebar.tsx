'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3,
  CalendarRange,
  Database,
  Flame,
  Landmark,
  ListChecks,
  Map,
  PhoneCall,
  ShieldCheck,
  Sprout,
  Waves,
  Wheat,
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
    { href: '/ministry', key: 'ministry', icon: Map },
    { href: '/watershed', key: 'watershed', icon: Map },
    { href: '/prediction', key: 'prediction', icon: CalendarRange },
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
    <div className="rounded-xl border border-white/10 bg-white/[0.06] p-3.5 backdrop-blur-xs">
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
      <Link
        href="/prediction/metrics"
        className="mt-2.5 flex items-center justify-between border-t border-white/10 pt-2 text-[10px] font-medium text-brand-lime/80 hover:text-brand-lime transition-colors"
      >
        <span>Performance & validation</span>
        <span>→</span>
      </Link>
    </div>
  )
}

/**
 * Ministerial executive policy directives quick-access toolkit.
 * Gives the Agricultural Minister of Ethiopia high-level command visibility.
 */
function MinisterToolkit() {
  const ts = useTranslations('sidebar')
  return (
    <div className="mx-3 my-2 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] p-3 text-xs">
      <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-amber-300 uppercase">
        <Landmark className="size-3.5 text-amber-400" />
        <span>{ts('executiveToolkit')}</span>
      </div>
      <div className="mt-2.5 flex flex-col gap-2">
        <div className="flex items-start gap-2">
          <Wheat className="mt-0.5 size-3.5 shrink-0 text-amber-300" />
          <div className="min-w-0">
            <span className="block font-semibold text-white/90">{ts('foodSecurity')}</span>
            <span className="block text-[10px] text-white/60">{ts('foodSecurityDesc')}</span>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Flame className="mt-0.5 size-3.5 shrink-0 text-risk-high" />
          <div className="min-w-0">
            <span className="block font-semibold text-white/90">{ts('emergencyRelief')}</span>
            <span className="block text-[10px] text-white/60">{ts('emergencyReliefDesc')}</span>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Map className="mt-0.5 size-3.5 shrink-0 text-brand-lime" />
          <div className="min-w-0">
            <span className="block font-semibold text-white/90">{ts('woredasCovered')}</span>
            <span className="block text-[10px] text-white/60">{ts('woredasDesc')}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Farmer extension & advisory service card.
 * Provides direct access to Ethiopia's national 8028 hotline and local Kebele DA.
 */
function FarmerServices() {
  const ts = useTranslations('sidebar')
  return (
    <div className="mx-3 my-2 flex flex-col gap-2">
      <p className="px-1 text-[10px] font-semibold tracking-[0.18em] text-white/40 uppercase">
        {ts('farmerSupport')}
      </p>
      <a
        href="tel:8028"
        className="group flex items-center gap-2.5 rounded-lg border border-brand-lime/30 bg-brand-lime/[0.08] p-2.5 transition-colors hover:border-brand-lime hover:bg-brand-lime/[0.15]"
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-brand-lime/20 text-brand-lime group-hover:bg-brand-lime group-hover:text-brand-forest-deep transition-colors">
          <PhoneCall className="size-3.5" />
        </span>
        <div className="min-w-0 leading-tight">
          <span className="block text-xs font-bold text-white group-hover:text-brand-lime transition-colors">
            {ts('hotline8028')}
          </span>
          <span className="block truncate text-[10px] text-white/60">{ts('hotlineDesc')}</span>
        </div>
      </a>
      <div className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.04] p-2.5">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-white/10 text-brand-sage">
          <ShieldCheck className="size-3.5" />
        </span>
        <div className="min-w-0 leading-tight">
          <span className="block text-xs font-semibold text-white/90">{ts('kebeleExtension')}</span>
          <span className="block truncate text-[10px] text-white/55">{ts('kebeleDesc')}</span>
        </div>
      </div>
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
  const ts = useTranslations('sidebar')
  const isMinister = user.role === 'minister'
  const isFarmer = user.role === 'farmer'
  const initials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase()

  return (
    <div className="mx-4 mb-2 flex flex-col gap-1.5 rounded-xl border border-white/10 bg-white/[0.06] p-3 shadow-xs">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-xs',
            isMinister
              ? 'bg-gradient-to-br from-amber-500 to-amber-700 ring-2 ring-amber-400/40'
              : 'bg-brand-sage/25 ring-1 ring-white/10',
          )}
          aria-hidden
        >
          {initials || '\u2014'}
        </span>
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-sm font-semibold text-white">{user.name}</span>
          <span className="block truncate text-[11px] text-white/60">{detail ?? tr(user.role)}</span>
        </span>
      </div>
      <div className="flex items-center justify-between border-t border-white/10 pt-1.5 text-[10px]">
        <span className="font-medium text-brand-sage">
          {isMinister ? ts('ministerDesk') : isFarmer ? ts('registeredSmallholder') : tr(user.role)}
        </span>
        <span className="rounded-sm bg-white/10 px-1.5 py-0.5 font-mono text-[9px] text-white/70">
          {isMinister ? ts('nationalOversight') : ts('activeSurveillance')}
        </span>
      </div>
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
  const ts = useTranslations('sidebar')
  const pathname = usePathname()
  const items = navForRole(user.role)
  const farmer = user.role === 'farmer'
  const isMinister = user.role === 'minister' || user.role === 'admin'

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
          'fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col overflow-y-auto bg-surface-inverse text-white shadow-xl transition-transform duration-300 lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Ethiopian sovereign tricolor ribbon */}
        <div
          className="h-1.5 w-full bg-gradient-to-r from-[#078930] via-[#FCDD09] to-[#DA121A] shrink-0"
          aria-hidden="true"
        />

        {/* Institutional Branding Header */}
        <div className="flex flex-col gap-2 border-b border-white/10 px-5 pt-4 pb-3">
          <div className="flex items-center justify-between">
            <Link
              href={items[0]?.href ?? '/'}
              onClick={onClose}
              className="flex items-center gap-3 rounded-lg focus-visible:ring-2 focus-visible:ring-brand-lime"
            >
              <span className="flex size-10 items-center justify-center overflow-hidden rounded-xl shadow-md shadow-black/20 ring-1 ring-white/15">
                <Image src="/icon.png" alt="AgriMinds" width={40} height={40} className="size-10 object-cover" />
              </span>
              <span className="leading-tight">
                <span className="block font-display text-base font-bold tracking-tight text-white">{t('name')}</span>
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

          {/* Ethiopian Ministry of Agriculture Official Subheader */}
          <div className="rounded-lg bg-white/[0.05] px-2.5 py-1.5 text-[10.5px] leading-tight text-white/75">
            <div className="font-semibold text-brand-lime flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-status-ok animate-pulse" aria-hidden />
              {ts('orgTitle')}
            </div>
            <div className="text-[9.5px] text-white/55 truncate">{ts('basinBadge')}</div>
          </div>
        </div>

        {farmer ? <FarmerIdentity user={user} /> : <Identity user={user} />}

        <nav className="flex-1 px-3 py-2">
          <p className="px-3 pb-2 text-[10px] font-semibold tracking-[0.18em] text-white/40 uppercase">
            {tn('section')}
          </p>
          <ul className="flex flex-col gap-0.5">
            {items.map(({ href, key, icon: Icon }) => {
              const active = pathname === href || (href !== '/' && pathname.startsWith(`${href}/`))
              const isPrediction = key === 'prediction'
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active && !isPrediction ? 'page' : undefined}
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
                  {isPrediction && (
                    <ul className="ml-8 mt-1 mb-1.5 flex flex-col gap-1 border-l border-white/10 pl-2.5 text-xs">
                      <li>
                        <Link
                          href="/prediction"
                          onClick={onClose}
                          className={cn(
                            'block rounded-md px-2 py-1 transition-colors',
                            pathname === '/prediction'
                              ? 'font-semibold text-brand-lime bg-white/[0.08]'
                              : 'text-white/60 hover:text-white',
                          )}
                        >
                          {tn('predictionHorizon')}
                        </Link>
                      </li>
                      <li>
                        <Link
                          href="/prediction/metrics"
                          onClick={onClose}
                          className={cn(
                            'block rounded-md px-2 py-1 transition-colors',
                            pathname === '/prediction/metrics'
                              ? 'font-semibold text-brand-lime bg-white/[0.08]'
                              : 'text-white/60 hover:text-white',
                          )}
                        >
                          {tn('predictionMetrics')}
                        </Link>
                      </li>
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>

          {farmer && pathname === '/farm' && <FarmSections onNavigate={onClose} />}

          {/* Farmer Advisory Hotline & Extension Services */}
          {farmer && <FarmerServices />}

          {/* Minister of Agriculture Strategic Executive Directives Toolkit */}
          {isMinister && <MinisterToolkit />}
        </nav>

        <div className="flex flex-col gap-3 px-4 pb-5">
          {farmer ? <LanguageChoice /> : <ModelCard />}
          <p className="px-1 text-[11px] leading-relaxed text-white/45">{t('workspaceSub')}</p>
        </div>
      </aside>
    </>
  )
}
