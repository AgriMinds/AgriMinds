'use client'

import { CloudRain, Droplets, Waves, Wind } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { EnsoOutlookResponse } from '@agriminds/api-types'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/**
 * Section 1 — the driver.
 *
 * The poster draws two Pacific SST maps. Here the equivalent information is live: where Niño 3.4
 * actually sits today on the warm/cool scale, and which of the two mechanisms that puts the
 * watershed in. The scale is the same diverging pair used by the charts, with the neutral band
 * drawn explicitly so ±0.5 °C is visible rather than implied.
 */
const SCALE_MIN = -3
const SCALE_MAX = 3
const COOL = '#2879b1'
const WARM = '#c67544'

function pos(index: number): number {
  const clamped = Math.min(SCALE_MAX, Math.max(SCALE_MIN, index))
  return ((clamped - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100
}

function Phase({
  active,
  title,
  cloud,
  rain,
  consequence,
  tone,
  icon,
}: {
  active: boolean
  title: string
  cloud: string
  rain: string
  consequence: string
  tone: 'warm' | 'cool'
  icon: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-2 rounded-xl border p-3',
        active
          ? tone === 'warm'
            ? 'border-[color:var(--enso-warm)] bg-[color:var(--enso-warm)]/8'
            : 'border-[color:var(--enso-cool)] bg-[color:var(--enso-cool)]/8'
          : 'border-border bg-surface-sunken/40 opacity-70',
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className="flex size-7 items-center justify-center rounded-lg text-white [&_svg]:size-4"
          style={{ background: tone === 'warm' ? WARM : COOL }}
          aria-hidden
        >
          {icon}
        </span>
        <span className="font-display text-sm font-bold">{title}</span>
        {active && (
          <span className="ml-auto rounded-full bg-fg px-2 py-0.5 text-[10px] font-semibold text-surface">
            now
          </span>
        )}
      </div>
      <ul className="flex flex-col gap-1 text-xs text-fg-muted">
        <li className="flex items-center gap-1.5">
          <CloudRain className="size-3.5 shrink-0" aria-hidden /> {cloud}
        </li>
        <li className="flex items-center gap-1.5">
          <Droplets className="size-3.5 shrink-0" aria-hidden /> {rain}
        </li>
      </ul>
      <p className="text-xs font-semibold text-fg">{consequence}</p>
    </div>
  )
}

export function EnsoDriverCard({ data }: { data?: EnsoOutlookResponse }) {
  const t = useTranslations('cropYield.driver')
  if (!data) return <Skeleton className="h-64" />

  const index = data.current_nino34
  const elNino = index >= 0.5
  const laNina = index <= -0.5

  return (
    <div
      className="flex flex-col gap-4"
      style={{ ['--enso-warm' as string]: WARM, ['--enso-cool' as string]: COOL }}
    >
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className="text-xs font-medium text-fg-muted">{t('index')}</span>
          <span className="font-display text-xl font-bold whitespace-nowrap tabular-nums">
            {index > 0 ? '+' : ''}
            {index.toFixed(2)} °C
          </span>
        </div>
        {/* Cool → neutral → warm, with the ±0.5 °C band marked. */}
        <div className="relative h-7">
          <div
            className="absolute inset-x-0 top-1.5 h-3 rounded-full"
            style={{ background: `linear-gradient(to right, ${COOL}, var(--pdsi-normal), ${WARM})` }}
            aria-hidden
          />
          <div
            className="absolute top-1.5 h-3 border-x border-surface/70 bg-surface/25"
            style={{ left: `${pos(-0.5)}%`, width: `${pos(0.5) - pos(-0.5)}%` }}
            aria-hidden
          />
          <div
            className="absolute top-0 size-6 -translate-x-1/2 rounded-full border-[3px] border-surface-raised shadow-md"
            style={{ left: `${pos(index)}%`, background: elNino ? WARM : laNina ? COOL : 'var(--fg-muted)' }}
            role="img"
            aria-label={`${t('index')}: ${index.toFixed(2)}`}
          />
        </div>
        <div className="flex justify-between text-[10px] text-fg-subtle">
          <span>{t('cooler')}</span>
          <span>{t('neutralBand')}</span>
          <span>{t('warmer')}</span>
        </div>
        <p className="text-xs leading-relaxed text-fg-muted">
          {t('state', { category: data.current_category })}
        </p>
      </div>

      {/* Two across on a tablet, but stacked again inside the narrow desktop column. */}
      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-1">
        <Phase
          active={elNino}
          tone="warm"
          icon={<Wind />}
          title={t('elNino')}
          cloud={t('elNinoCloud')}
          rain={t('elNinoRain')}
          consequence={t('elNinoResult')}
        />
        <Phase
          active={laNina}
          tone="cool"
          icon={<Waves />}
          title={t('laNina')}
          cloud={t('laNinaCloud')}
          rain={t('laNinaRain')}
          consequence={t('laNinaResult')}
        />
      </div>
    </div>
  )
}
