'use client'

import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Info,
  Layers,
  Navigation,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { DroughtMapResponse, LeadMonth, RiskLevel } from '@agriminds/api-types'
import { LEAD_MONTHS } from '@agriminds/api-types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardIcon, CardTitle } from '@/components/ui/card'
import { QueryError } from '@/components/ui/query-state'
import { Skeleton } from '@/components/ui/skeleton'
import { RISK_DOT_CLASS, cellClassFor } from '@/lib/risk'
import { cn, formatPercent } from '@/lib/utils'

export type Cell = { row: number; col: number }

type Props = {
  mapData?: DroughtMapResponse
  isLoading: boolean
  isFetching: boolean
  error: unknown
  onRetry: () => void
  selectedLead: LeadMonth
  onLeadChange: (lead: LeadMonth) => void
  selectedCell: Cell
  onCellSelect: (cell: Cell) => void
}

const RISK_BADGE: Record<RiskLevel, 'low' | 'moderate' | 'high' | 'severe'> = {
  Low: 'low',
  Moderate: 'moderate',
  High: 'high',
  Severe: 'severe',
}

export function WatershedGridMap({
  mapData,
  isLoading,
  isFetching,
  error,
  onRetry,
  selectedLead,
  onLeadChange,
  selectedCell,
  onCellSelect,
}: Props) {
  const t = useTranslations('grid')
  const tr = useTranslations('risk')
  const [rows, cols] = mapData?.grid_shape ?? [8, 8]
  const selected = mapData?.cells.find((c) => c.row === selectedCell.row && c.col === selectedCell.col)
  const move = (dr: number, dc: number) =>
    onCellSelect({
      row: Math.min(Math.max(0, selectedCell.row + dr), rows - 1),
      col: Math.min(Math.max(0, selectedCell.col + dc), cols - 1),
    })
  const leadLabel: Record<LeadMonth, string> = { 1: t('lead1'), 2: t('lead2'), 3: t('lead3') }

  return (
    <Card>
      <CardHeader>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <CardIcon>
              <Layers />
            </CardIcon>
            <CardTitle>{t('title')}</CardTitle>
          </div>
          <CardDescription>{t('subtitle')}</CardDescription>
        </div>
        <div
          role="group"
          aria-label={t('leadGroup')}
          className="flex items-center gap-1 self-start rounded-xl bg-surface-sunken p-1"
        >
          <span className="hidden items-center gap-1 px-2 text-[11px] font-semibold text-fg-muted sm:flex">
            <Calendar className="size-3" /> {t('leadLabel')}
          </span>
          {LEAD_MONTHS.map((lead) => (
            <button
              key={lead}
              type="button"
              onClick={() => onLeadChange(lead)}
              aria-pressed={selectedLead === lead}
              className={cn(
                'min-h-9 rounded-lg px-2.5 text-[11px] font-bold transition-colors focus-visible:ring-2 focus-visible:ring-ring sm:text-xs',
                selectedLead === lead
                  ? 'bg-primary text-primary-fg shadow-xs'
                  : 'text-fg-muted hover:bg-border/50 hover:text-fg',
              )}
            >
              <span className="hidden sm:inline">{leadLabel[lead]}</span>
              <span className="sm:hidden">{lead} mo</span>
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent>
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-[11px] sm:text-xs">
          <span className="truncate">
            <strong>{t('targetHorizon')}:</strong> {mapData?.target_date ?? t('pending')}
          </span>
          <span className="truncate">
            <strong>{t('issued')}:</strong> {mapData?.issued_date ?? '--'}
          </span>
          <span className="truncate font-semibold">
            <strong>{t('meanBasinRisk')}:</strong> {formatPercent(mapData?.mean_probability)}
          </span>
        </div>

        {error && !mapData ? (
          <QueryError error={error} onRetry={onRetry} isRetrying={isFetching} />
        ) : (
          <div className="relative">
            {isFetching && mapData && (
              <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-surface-raised/70 backdrop-blur-[2px]">
                <span className="flex items-center gap-2 text-xs font-semibold text-primary">
                  <span className="size-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  {t('computingInference')}
                </span>
              </div>
            )}
            <div
              role="grid"
              aria-label={t('title')}
              className="grid gap-1 rounded-2xl border border-border bg-surface-sunken p-1.5 sm:gap-1.5 sm:p-2"
              style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
            >
              {isLoading && !mapData
                ? Array.from({ length: rows * cols }, (_, i) => (
                    <Skeleton key={i} className="aspect-square rounded-md sm:rounded-lg" />
                  ))
                : mapData?.probabilities.map((rowVals, r) =>
                    rowVals.map((p, c) => {
                      const isSelected = r === selectedCell.row && c === selectedCell.col
                      return (
                        <button
                          key={`${r}-${c}`}
                          type="button"
                          role="gridcell"
                          aria-selected={isSelected}
                          aria-label={t('cellAria', { row: r, col: c, pct: formatPercent(p) })}
                          onClick={() => onCellSelect({ row: r, col: c })}
                          className={cn(
                            'flex aspect-square flex-col items-center justify-center rounded-md p-0.5 font-black transition-[transform,opacity] duration-150 active:scale-90 sm:rounded-lg',
                            cellClassFor(p),
                            isSelected
                              ? 'z-10 scale-105 shadow-lg ring-3 ring-fg sm:ring-4'
                              : 'opacity-90 hover:opacity-100 hover:scale-[1.02]',
                          )}
                        >
                          <span className="text-[10px] leading-none sm:text-xs">{formatPercent(p)}</span>
                          <span className="mt-0.5 hidden font-mono text-[8px] leading-none opacity-80 sm:block sm:text-[9px]">
                            {r},{c}
                          </span>
                        </button>
                      )
                    }),
                  )}
            </div>
          </div>
        )}

        {selected && (
          <div className="flex flex-col justify-between gap-2.5 rounded-xl border border-border bg-surface-sunken/70 p-2.5 sm:flex-row sm:items-center sm:p-3">
            <div className="flex min-w-0 items-center gap-2">
              <CardIcon className="size-6 [&_svg]:size-3.5">
                <Navigation />
              </CardIcon>
              <div className="truncate text-[11px] sm:text-xs">
                {t('selectedCell')}:{' '}
                <strong>
                  {selected.row},{selected.col}
                </strong>{' '}
                <span className="font-mono text-fg-subtle">
                  ({selected.latitude}°N, {selected.longitude}°E)
                </span>
              </div>
            </div>
            <div className="flex shrink-0 items-center justify-between gap-2.5 sm:justify-end">
              <div className="flex items-center gap-0.5 rounded-lg bg-border/50 p-0.5">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t('moveLeft')}
                  disabled={selectedCell.col === 0}
                  onClick={() => move(0, -1)}
                >
                  <ChevronLeft />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t('moveUp')}
                  disabled={selectedCell.row === 0}
                  onClick={() => move(-1, 0)}
                >
                  <ChevronUp />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t('moveDown')}
                  disabled={selectedCell.row === rows - 1}
                  onClick={() => move(1, 0)}
                >
                  <ChevronDown />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t('moveRight')}
                  disabled={selectedCell.col === cols - 1}
                  onClick={() => move(0, 1)}
                >
                  <ChevronRight />
                </Button>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="font-extrabold">{formatPercent(selected.probability, 1)}</span>
                <Badge variant={RISK_BADGE[selected.risk_level]}>{tr(selected.risk_level)}</Badge>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-fg-muted sm:text-xs">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="font-bold text-fg">{t('legend')}:</span>
            {(['Low', 'Moderate', 'High', 'Severe'] as const).map((lvl) => (
              <span key={lvl} className="flex items-center gap-1">
                <span className={cn('size-2 rounded-full', RISK_DOT_CLASS[lvl])} />
                {t(`${lvl.toLowerCase()}Risk` as 'lowRisk' | 'moderateRisk' | 'highRisk' | 'severeRisk')}
              </span>
            ))}
          </div>
          <span className="flex items-center gap-1 font-mono text-[10px] text-fg-subtle">
            <Info className="size-3 shrink-0" /> {t('bbox')}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
