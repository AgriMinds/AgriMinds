'use client'

import { MapPin, Pencil, Ruler } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { Farm, PdsiCategory, RiskLevel } from '@agriminds/api-types'
import { Badge } from '@/components/ui/badge'
import { PDSI_DOT_CLASS, PDSI_ICON, pdsiKey } from '@/lib/classification'
import { RISK_BADGE_VARIANT } from '@/lib/risk'
import { cn, formatPercent } from '@/lib/utils'

type Props = {
  farm: Farm
  selected: boolean
  onSelect: () => void
  onEdit: () => void
  /** Measured dryness of this plot's cell today; separate from the forecast below. */
  ground?: PdsiCategory | null
}

export function PlotCard({ farm, selected, onSelect, onEdit, ground }: Props) {
  const t = useTranslations('farmer')
  const ta = useTranslations('advisory')
  const tr = useTranslations('risk')
  const tp = useTranslations('pdsi')
  const GroundIcon = ground ? PDSI_ICON[ground] : null
  const level = farm.risk?.risk_level as RiskLevel | undefined

  return (
    <div
      className={cn(
        'relative flex flex-col gap-3 rounded-2xl border bg-surface-raised p-4 shadow-sm transition-[border-color,box-shadow]',
        selected ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-border-strong',
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className="flex min-h-11 flex-col items-start gap-1 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <span className="font-display text-base font-semibold">{farm.name}</span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
          <span className="flex items-center gap-1">
            <Ruler className="size-3.5" aria-hidden /> {farm.area_hectares} {t('hectaresShort')}
          </span>
          <span>{ta(`crops.${farm.primary_crop}.label`)}</span>
        </span>
      </button>

      <div className="flex items-end justify-between gap-2">
        {farm.risk && level ? (
          <div>
            <p className="text-[11px] text-fg-subtle">{t('landRisk')}</p>
            <div className="font-display text-2xl font-bold tabular">{formatPercent(farm.risk.probability)}</div>
            <Badge variant={RISK_BADGE_VARIANT[level]} size="sm" className="mt-1">
              {tr(level)}
            </Badge>
          </div>
        ) : (
          <p className="text-xs text-fg-subtle">{t('riskUnavailable')}</p>
        )}
        <button
          type="button"
          onClick={onEdit}
          aria-label={t('editPlotNamed', { plot: farm.name })}
          className="flex size-10 items-center justify-center rounded-lg border border-border text-fg-muted transition-colors hover:bg-surface-sunken hover:text-fg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Pencil className="size-4" />
        </button>
      </div>

      {/* Measured now, not forecast: kept on its own line with its own wording. */}
      {ground && GroundIcon && (
        <p className="flex items-center gap-1.5 border-t border-border pt-2.5 text-xs text-fg-muted">
          <span className={cn('size-2 shrink-0 rounded-full', PDSI_DOT_CLASS[ground])} aria-hidden />
          <GroundIcon className="size-3.5 shrink-0 text-fg-subtle" aria-hidden />
          {t('groundNow', { band: tp(pdsiKey(ground)) })}
        </p>
      )}

      <p className="flex items-center gap-1 font-mono text-[11px] text-fg-subtle">
        <MapPin className="size-3 shrink-0" aria-hidden />
        {farm.latitude.toFixed(3)}°N, {farm.longitude.toFixed(3)}°E
      </p>
    </div>
  )
}
