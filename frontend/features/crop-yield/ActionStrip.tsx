'use client'

import { CalendarClock, Droplets, Sprout, TrendingUp, TriangleAlert } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { EnsoImpactResponse } from '@agriminds/api-types'
import { cn } from '@/lib/utils'

/**
 * Section 4 — what to do about it.
 *
 * Three standing agronomic practices, then two derived from the matrix: the belt where a crop
 * actually gained, and the worst pairing in the record. The derived two are marked, so a reader
 * can tell which lines came from this deployment's data and which are general advice.
 *
 * One column on a phone, two on a tablet, the full row of five only where there is room for the
 * text to stay above about forty characters a line.
 */
export function ActionStrip({ data }: { data: EnsoImpactResponse }) {
  const t = useTranslations('cropYield.actions')
  const ta = useTranslations('advisory')
  const best = data.recommendations.find((r) => !r.still_negative) ?? data.recommendations[0]
  const worst = data.cautions[0]

  const items = [
    { key: 'forecasts', icon: CalendarClock, text: t('forecasts'), derived: false },
    { key: 'irrigation', icon: Droplets, text: t('irrigation'), derived: false },
    { key: 'varieties', icon: Sprout, text: t('varieties'), derived: false },
    best && {
      key: 'favour',
      icon: TrendingUp,
      text: t('favour', { crop: ta(`crops.${best.crop}.label`), zone: best.zone }),
      derived: true,
    },
    worst && {
      key: 'caution',
      icon: TriangleAlert,
      text: t('caution', { crop: ta(`crops.${worst.crop}.label`), zone: worst.zone }),
      derived: true,
    },
  ].filter(Boolean) as {
    key: string
    icon: React.ComponentType<{ className?: string }>
    text: string
    derived: boolean
  }[]

  return (
    <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-5 xl:gap-3">
      {items.map(({ key, icon: Icon, text, derived }) => (
        <li
          key={key}
          className={cn(
            'flex items-start gap-3 rounded-2xl border bg-surface-raised p-3 transition-colors xl:flex-col xl:gap-2.5',
            derived ? 'border-primary/30' : 'border-border',
          )}
        >
          <span
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-xl [&_svg]:size-4.5',
              derived ? 'bg-primary/12 text-primary' : 'bg-surface-sunken text-fg-muted',
            )}
            aria-hidden
          >
            <Icon />
          </span>
          <span className="min-w-0">
            <span className="block text-xs leading-relaxed text-fg sm:text-[13px]">{text}</span>
            {derived && (
              <span className="mt-1 inline-block rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                {t('fromRecord')}
              </span>
            )}
          </span>
        </li>
      ))}
    </ul>
  )
}
