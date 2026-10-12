'use client'

import { AlertTriangle, ArrowRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { EnsoImpactResponse } from '@agriminds/api-types'
import { cn } from '@/lib/utils'

import { BeltScene, CropGlyph } from './CropArt'

/**
 * Section 3 — which crop to favour in each belt during an El Niño year.
 *
 * Derived from the matrix above, not written by hand: the recommendation is whichever crop held
 * up best in that belt. Where even the best crop lost yield, the card says "smallest loss" —
 * that is a different claim from a gain, and the poster's green arrow would hide it.
 *
 * The belt scene and the crop glyph carry the pairing at a glance; the arrow between them is the
 * whole sentence, so the layout survives being squeezed to one column on a phone.
 */
export function BeltRecommendations({ data }: { data: EnsoImpactResponse }) {
  const t = useTranslations('cropYield.belts')
  const ti = useTranslations('cropYield.impact')
  const ta = useTranslations('advisory')
  const worst = data.cautions[0]

  return (
    <div className="flex flex-col gap-3">
      {data.recommendations.map((rec) => {
        const gain = !rec.still_negative
        return (
          <div
            key={rec.zone}
            className={cn(
              'group relative overflow-hidden rounded-2xl border p-3 transition-colors sm:p-3.5',
              gain
                ? 'border-primary/35 bg-primary/6 hover:border-primary/55'
                : 'border-border bg-surface-sunken/40 hover:border-border-strong',
            )}
          >
            {/* Row 1: the belt. Row 2: the crop and its number. Splitting them this way keeps
                the card readable in the narrow desktop column, where a single row truncates. */}
            <div className="flex items-center gap-3">
              <BeltScene zone={rec.zone} className="size-11 shrink-0 sm:size-12" />
              <div className="min-w-0 flex-1 leading-tight">
                <p className="font-display text-sm font-bold sm:text-base">{rec.zone}</p>
                <p className="text-[11px] whitespace-nowrap text-fg-subtle">
                  {rec.zone_local_name} · {ti(`band.${rec.zone}`)}
                </p>
              </div>
              <ArrowRight className="size-4 shrink-0 text-fg-subtle" aria-hidden />
            </div>
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-t border-border/70 pt-2.5">
              <span className="flex items-center gap-2">
                <CropGlyph
                  crop={rec.crop}
                  className={cn('size-6 shrink-0 sm:size-7', gain ? 'text-primary' : 'text-fg-muted')}
                />
                <span className="font-display text-base font-bold sm:text-lg">
                  {ta(`crops.${rec.crop}.label`)}
                </span>
              </span>
              <span className="min-w-0 text-right leading-tight">
                <span className={cn('block text-xs font-medium', gain ? 'text-primary' : 'text-fg-muted')}>
                  {gain
                    ? t('gains', { pct: rec.effect_pct.toFixed(2) })
                    : t('leastLoss', { pct: Math.abs(rec.effect_pct).toFixed(2) })}
                </span>
                <span className="block text-[11px] text-fg-subtle tabular-nums">
                  p = {rec.p_value.toFixed(3)} · {rec.significant ? t('supported') : t('notSupported')}
                </span>
              </span>
            </div>
          </div>
        )
      })}

      {worst && (
        <div className="flex gap-2.5 rounded-2xl border border-status-bad/30 bg-status-bad/8 p-3 sm:gap-3 sm:p-3.5">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-status-bad" aria-hidden />
          <p className="text-xs leading-relaxed text-fg">
            {t('caution', {
              crop: ta(`crops.${worst.crop}.label`),
              zone: worst.zone,
              pct: Math.abs(worst.effect_pct).toFixed(2),
            })}
          </p>
        </div>
      )}
    </div>
  )
}
