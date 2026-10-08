'use client'

import { useTranslations } from 'next-intl'
import type { CropMixEntry } from '@agriminds/api-types'

/** Hectares registered per staple crop, and how many of those plots sit in an at-risk cell. */
export function CropMix({ entries }: { entries: CropMixEntry[] }) {
  const t = useTranslations('ministry')
  const ta = useTranslations('advisory')
  const total = entries.reduce((sum, e) => sum + e.hectares, 0)

  if (entries.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border-strong px-4 py-6 text-center text-sm text-fg-muted">
        {t('noPlots')}
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-3">
      {entries.map((entry) => {
        const share = total > 0 ? (entry.hectares / total) * 100 : 0
        return (
          <li key={entry.crop} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium">{ta(`crops.${entry.crop}.label`)}</span>
              <span className="tabular text-fg-muted">
                {entry.hectares.toFixed(1)} {t('hectaresShort')} · {entry.farms} {t('plots').toLowerCase()}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-sunken">
              <div className="h-full rounded-full bg-primary" style={{ width: `${share}%` }} aria-hidden />
            </div>
            {entry.farms_at_risk > 0 && (
              <p className="text-xs text-risk-high">{t('cropAtRisk', { count: entry.farms_at_risk })}</p>
            )}
          </li>
        )
      })}
    </ul>
  )
}
