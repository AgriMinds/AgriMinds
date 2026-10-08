'use client'

import { CalendarRange } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { DroughtMapResponse, LeadMonth } from '@agriminds/api-types'
import { LEAD_MONTHS } from '@agriminds/api-types'
import { SegmentedControl } from '@/components/ui/segmented'

type Props = { lead: LeadMonth; onLeadChange: (l: LeadMonth) => void; map?: DroughtMapResponse }

/** Global forecast controls: the lead horizon drives the map, the KPIs and the advisory. */
export function ForecastControls({ lead, onLeadChange, map }: Props) {
  const t = useTranslations('controls')
  const tg = useTranslations('grid')
  const label = (l: LeadMonth) => (
    <>
      <span className="sm:hidden">{tg(`lead${l}Short`)}</span>
      <span className="hidden sm:inline">{tg(`lead${l}`)}</span>
    </>
  )
  return (
    <div className="flex flex-col gap-2 sm:items-end">
      <SegmentedControl
        aria-label={tg('leadGroup')}
        value={lead}
        onChange={onLeadChange}
        size="md"
        options={LEAD_MONTHS.map((l) => ({ value: l, label: label(l) }))}
        className="self-start sm:self-end"
      />
      <p className="flex items-center gap-1.5 text-xs text-fg-muted">
        <CalendarRange className="size-3.5 text-primary" aria-hidden />
        <span>
          {t('target')}: <strong className="font-semibold text-fg">{map?.target_date ?? '—'}</strong>
          <span className="mx-1.5 text-border-strong">·</span>
          {t('issued')}: <strong className="font-semibold text-fg">{map?.issued_date ?? '—'}</strong>
        </span>
      </p>
    </div>
  )
}
