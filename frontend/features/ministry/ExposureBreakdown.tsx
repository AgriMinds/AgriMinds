'use client'

import { useTranslations } from 'next-intl'
import type { RiskExposure, RiskLevel } from '@agriminds/api-types'
import { Badge } from '@/components/ui/badge'
import { RISK_BADGE_VARIANT, RISK_DOT_CLASS } from '@/lib/risk'
import { cn } from '@/lib/utils'

const ORDER: RiskLevel[] = ['Low', 'Moderate', 'High', 'Severe']

/**
 * How the registered plots sit across the four risk levels.
 * The bar is a summary; the table beneath carries the same numbers for anyone who cannot
 * distinguish the colours.
 */
export function ExposureBreakdown({ exposure }: { exposure: RiskExposure }) {
  const t = useTranslations('ministry')
  const tr = useTranslations('risk')
  const total = exposure.buckets.reduce((sum, b) => sum + b.farms, 0)
  const byLevel = new Map(exposure.buckets.map((b) => [b.risk_level as RiskLevel, b]))

  return (
    <div data-testid="exposure-breakdown" className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-base font-semibold">{t('exposureTitle')}</h3>
        <span className="text-xs text-fg-muted">{t('forTarget', { target: exposure.target_date })}</span>
      </div>

      {total === 0 ? (
        <p className="rounded-xl border border-dashed border-border-strong px-4 py-6 text-center text-sm text-fg-muted">
          {t('noPlots')}
        </p>
      ) : (
        <>
          <div
            className="flex h-3 w-full overflow-hidden rounded-full bg-surface-sunken"
            role="img"
            aria-label={ORDER.map((l) => `${tr(l)}: ${byLevel.get(l)?.farms ?? 0}`).join(', ')}
          >
            {ORDER.map((level) => {
              const farms = byLevel.get(level)?.farms ?? 0
              if (!farms) return null
              return (
                <span
                  key={level}
                  className={cn(RISK_DOT_CLASS[level])}
                  style={{ width: `${(farms / total) * 100}%` }}
                />
              )
            })}
          </div>

          <table className="w-full text-sm">
            <caption className="sr-only">{t('exposureTitle')}</caption>
            <thead>
              <tr className="text-left text-xs font-semibold tracking-wide text-fg-muted uppercase">
                <th scope="col" className="pb-2">{t('level')}</th>
                <th scope="col" className="pb-2 text-right">{t('plots')}</th>
                <th scope="col" className="pb-2 text-right">{t('farmers')}</th>
                <th scope="col" className="pb-2 text-right">{t('hectares')}</th>
              </tr>
            </thead>
            <tbody>
              {ORDER.map((level) => {
                const bucket = byLevel.get(level)
                return (
                  <tr key={level} className="border-t border-border">
                    <th scope="row" className="py-2 text-left font-normal">
                      <Badge variant={RISK_BADGE_VARIANT[level]} size="sm">
                        {tr(level)}
                      </Badge>
                    </th>
                    <td className="py-2 text-right tabular">{bucket?.farms ?? 0}</td>
                    <td className="py-2 text-right tabular">{bucket?.farmers ?? 0}</td>
                    <td className="py-2 text-right tabular">{(bucket?.hectares ?? 0).toFixed(1)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}
