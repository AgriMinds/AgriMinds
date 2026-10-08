'use client'

import { Crosshair, Droplets, Flame, Waves } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { DroughtMapResponse, EnsoOutlookResponse, LeadMonth } from '@agriminds/api-types'
import { Badge } from '@/components/ui/badge'
import { Stat } from '@/components/ui/stat'
import { RISK_BADGE_VARIANT, ensoPhase, summarize } from '@/lib/risk'
import { cn, formatPercent, formatSigned } from '@/lib/utils'

type Props = {
  mapData?: DroughtMapResponse
  ensoData?: EnsoOutlookResponse
  isLoading: boolean
  selectedLead: LeadMonth
  onSelectCell?: (cell: { row: number; col: number }) => void
}

/** Min–mean–max range bar for the basin. */
function RangeBar({ min, mean, max }: { min: number; mean: number; max: number }) {
  const pct = (v: number) => `${Math.min(100, Math.max(0, v * 100))}%`
  return (
    <div className="relative h-2 w-full rounded-full bg-surface-sunken" aria-hidden>
      <div
        className="absolute inset-y-0 rounded-full bg-gradient-to-r from-risk-low via-risk-moderate to-risk-severe opacity-80"
        style={{ left: pct(min), width: `calc(${pct(max)} - ${pct(min)})` }}
      />
      <div className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface-raised bg-fg shadow-sm" style={{ left: pct(mean) }} />
    </div>
  )
}

export function WatershedSummary({ mapData, ensoData, isLoading, selectedLead, onSelectCell }: Props) {
  const t = useTranslations('summary')
  const tr = useTranslations('risk')
  const tc = useTranslations('common')
  const s = summarize(mapData)
  const loading = isLoading && !mapData
  const phase = ensoData ? ensoPhase(ensoData.current_nino34) : null

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Stat
        icon={<Droplets />}
        label={t('basinMeanRisk')}
        value={formatPercent(mapData?.mean_probability)}
        loading={loading}
        detail={
          mapData
            ? `${t('range')}: ${formatPercent(mapData.min_probability)} – ${formatPercent(mapData.max_probability)}`
            : `${tc('lead')} ${tc('months', { count: selectedLead })}`
        }
      >
        {mapData && <RangeBar min={mapData.min_probability} mean={mapData.mean_probability} max={mapData.max_probability} />}
      </Stat>

      <Stat
        icon={<Crosshair />}
        label={t('highestRiskCell')}
        tone="bg-risk-high-soft text-risk-high"
        value={formatPercent(s?.highest?.probability)}
        loading={loading}
        onClick={s?.highest && onSelectCell ? () => onSelectCell({ row: s.highest!.row, col: s.highest!.col }) : undefined}
        aria-label={s?.highest ? `${t('highestRiskCell')} ${formatPercent(s.highest.probability)}, ${t('selectCell')}` : undefined}
        detail={
          s?.highest ? (
            <span className="flex flex-col gap-0.5">
              <span className="font-mono">
                {s.highest.row},{s.highest.col} · {s.highest.latitude}°N, {s.highest.longitude}°E
              </span>
              <span className="font-medium text-primary underline-offset-2 group-hover:underline">{t('selectCell')} →</span>
            </span>
          ) : undefined
        }
      >
        {s?.highest && <Badge variant={RISK_BADGE_VARIANT[s.highest.risk_level]} size="sm">{tr(s.highest.risk_level)}</Badge>}
      </Stat>

      <Stat
        icon={<Flame />}
        label={t('cellsAtRisk')}
        tone="bg-risk-severe-soft text-risk-severe"
        value={s ? s.atRisk : '—'}
        loading={loading}
        detail={s ? t('ofCells', { total: s.total }) : undefined}
      >
        {s && (
          <div className="flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full" aria-hidden>
            {mapData?.cells.map((c) => (
              <span
                key={`${c.row}-${c.col}`}
                className={cn('flex-1', c.risk_level === 'High' || c.risk_level === 'Severe' ? 'bg-risk-severe' : 'bg-surface-sunken')}
              />
            ))}
          </div>
        )}
      </Stat>

      <Stat
        icon={<Waves />}
        label={t('ensoState')}
        tone={cn(phase === 'warm' && 'bg-enso-warm/12 text-enso-warm', phase === 'cool' && 'bg-enso-cool/12 text-enso-cool', phase === 'neutral' && 'bg-primary/12 text-primary')}
        value={ensoData ? ensoData.current_state : '—'}
        loading={!ensoData}
        detail={ensoData ? `${t('nino34')}: ${formatSigned(ensoData.current_nino34)} °C` : undefined}
      />
    </div>
  )
}
