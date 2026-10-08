'use client'

import { useTranslations } from 'next-intl'
import type { AdvisoryDelivery } from '@agriminds/api-types'

/**
 * Advisory delivery, counted from the records the platform actually wrote.
 * When nothing has been issued in the window the rate is absent rather than zero,
 * so an empty programme never reads as a failing one.
 */
export function DeliveryCard({ delivery }: { delivery: AdvisoryDelivery }) {
  const t = useTranslations('ministry')
  const rows: Array<[string, string]> = [
    [t('issuedTotal'), String(delivery.issued_total)],
    [t('issued30d'), String(delivery.issued_30d)],
    [t('acknowledged30d'), String(delivery.acknowledged_30d)],
  ]

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-3 gap-3">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-col gap-1">
            <dt className="text-xs leading-snug text-fg-muted">{label}</dt>
            <dd className="font-display text-2xl font-bold tabular">{value}</dd>
          </div>
        ))}
      </dl>

      {delivery.acknowledgement_rate === null || delivery.acknowledgement_rate === undefined ? (
        <p className="rounded-xl border border-dashed border-border-strong px-3.5 py-3 text-xs leading-relaxed text-fg-muted">
          {t('noDelivery')}
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-fg-muted">{t('acknowledgementRate')}</span>
            <span className="font-display text-base font-bold tabular">
              {Math.round(delivery.acknowledgement_rate * 100)}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-sunken">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.min(delivery.acknowledgement_rate * 100, 100)}%` }}
              aria-hidden
            />
          </div>
        </div>
      )}
    </div>
  )
}
