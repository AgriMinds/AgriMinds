'use client'

import { useCallback, useRef } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Compass, Map } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { DroughtMapResponse, LeadMonth, RiskLevel } from '@agriminds/api-types'
import { RISK_THRESHOLDS } from '@agriminds/api-types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardActions, CardContent, CardDescription, CardFooter, CardHeader, CardHeading, CardIcon, CardTitle } from '@/components/ui/card'
import { QueryError } from '@/components/ui/query-state'
import { Skeleton } from '@/components/ui/skeleton'
import { RISK_BADGE_VARIANT, RISK_DOT_CLASS, RISK_TEXT_CLASS, cellClassFor } from '@/lib/risk'
import { cn, formatPercent } from '@/lib/utils'

export type Cell = { row: number; col: number }

type Props = {
  mapData?: DroughtMapResponse
  isLoading: boolean
  isFetching: boolean
  error: unknown
  onRetry: () => void
  selectedLead: LeadMonth
  selectedCell: Cell
  onCellSelect: (cell: Cell) => void
}

const LEVELS: RiskLevel[] = ['Low', 'Moderate', 'High', 'Severe']

/** Threshold legend: four coloured segments proportional to their probability range. */
function Legend({ t }: { t: ReturnType<typeof useTranslations<'grid'>> }) {
  const stops = [0, ...RISK_THRESHOLDS.slice(0, 3).map((r) => r.below), 1]
  return (
    <div className="w-full">
      <div className="flex h-2 w-full overflow-hidden rounded-full" aria-hidden>
        {LEVELS.map((lvl, i) => (
          <span key={lvl} className={cn(RISK_DOT_CLASS[lvl])} style={{ flexGrow: stops[i + 1]! - stops[i]! }} />
        ))}
      </div>
      <div className="relative mt-1 h-4 text-[10px] font-medium text-fg-subtle tabular" aria-hidden>
        {stops.map((s) => (
          <span key={s} className="absolute -translate-x-1/2" style={{ left: `${s * 100}%` }}>
            {Math.round(s * 100)}%
          </span>
        ))}
      </div>
      <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-fg-muted">
        {LEVELS.map((lvl) => (
          <li key={lvl} className="flex items-center gap-1.5">
            <span className={cn('size-2 rounded-full', RISK_DOT_CLASS[lvl])} aria-hidden />
            {t(`${lvl.toLowerCase()}Risk` as 'lowRisk' | 'moderateRisk' | 'highRisk' | 'severeRisk')}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function WatershedGridMap({ mapData, isLoading, isFetching, error, onRetry, selectedLead, selectedCell, onCellSelect }: Props) {
  const t = useTranslations('grid')
  const tr = useTranslations('risk')
  const gridRef = useRef<HTMLDivElement>(null)
  const [rows, cols] = mapData?.grid_shape ?? [8, 8]
  const [lonMin, latMin, lonMax, latMax] = mapData?.bbox ?? [37.6, 10.4, 38.4, 11.2]
  const selected = mapData?.cells.find((c) => c.row === selectedCell.row && c.col === selectedCell.col)

  const move = useCallback(
    (dr: number, dc: number) => {
      const next = {
        row: Math.min(Math.max(0, selectedCell.row + dr), rows - 1),
        col: Math.min(Math.max(0, selectedCell.col + dc), cols - 1),
      }
      onCellSelect(next)
      gridRef.current?.querySelector<HTMLButtonElement>(`[data-cell="${next.row}-${next.col}"]`)?.focus()
    },
    [selectedCell, rows, cols, onCellSelect],
  )

  const onKeyDown = (e: React.KeyboardEvent) => {
    const d: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }
    const delta = d[e.key]
    if (!delta) return
    e.preventDefault()
    move(...delta)
  }

  const lat = (r: number) => (latMax - ((r + 0.5) * (latMax - latMin)) / rows).toFixed(2)
  const lon = (c: number) => (lonMin + ((c + 0.5) * (lonMax - lonMin)) / cols).toFixed(2)

  return (
    <Card className="h-full">
      <CardHeader>
        <CardHeading>
          <CardIcon>
            <Map />
          </CardIcon>
          <div className="min-w-0">
            <CardTitle>{t('title')}</CardTitle>
            <CardDescription>{t('probabilityOfDrought')}</CardDescription>
          </div>
        </CardHeading>
        <CardActions>
          <Badge variant="outline">{t(`lead${selectedLead}` as 'lead1' | 'lead2' | 'lead3')}</Badge>
          {mapData && <Badge variant="default">{mapData.target_date}</Badge>}
        </CardActions>
      </CardHeader>

      <CardContent>
        {error && !mapData ? (
          <QueryError error={error} onRetry={onRetry} isRetrying={isFetching} />
        ) : (
          <div className="relative">
            {isFetching && mapData && (
              <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-surface-raised/60 backdrop-blur-[1px]">
                <span className="flex items-center gap-2 rounded-full border border-border bg-surface-raised px-3 py-1.5 text-xs font-semibold text-primary shadow-md">
                  <span className="size-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  {t('computingInference')}
                </span>
              </div>
            )}

            {/* Map frame: longitude ticks across the top, latitude ticks down the left. */}
            <div className="rounded-2xl border border-border bg-surface-sunken/60 p-3 sm:p-4">
              <div className="mb-1.5 flex items-center justify-between pl-9 text-[10px] font-semibold tracking-wide text-fg-subtle uppercase">
                <span>{t('west')}</span>
                <span className="flex items-center gap-1 text-fg-muted">
                  <Compass className="size-3.5 text-primary" aria-hidden /> {t('north')}
                </span>
                <span>{t('east')}</span>
              </div>
              <div className="grid grid-cols-[auto_1fr] gap-1.5">
                <div className="flex flex-col justify-around pr-1 font-mono text-[9px] text-fg-subtle tabular sm:text-[10px]" aria-hidden>
                  {Array.from({ length: rows }, (_, r) => (
                    <span key={r} className="text-right leading-none">
                      {lat(r)}
                    </span>
                  ))}
                </div>
                <div
                  ref={gridRef}
                  role="grid"
                  aria-label={t('title')}
                  aria-rowcount={rows}
                  aria-colcount={cols}
                  onKeyDown={onKeyDown}
                  className="grid gap-1 sm:gap-1.5"
                  style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
                >
                  {isLoading && !mapData
                    ? Array.from({ length: rows * cols }, (_, i) => <Skeleton key={i} className="aspect-square rounded-md" />)
                    : mapData?.probabilities.map((rowVals, r) =>
                        rowVals.map((p, c) => {
                          const isSelected = r === selectedCell.row && c === selectedCell.col
                          return (
                            <button
                              key={`${r}-${c}`}
                              type="button"
                              role="gridcell"
                              data-cell={`${r}-${c}`}
                              tabIndex={isSelected ? 0 : -1}
                              aria-selected={isSelected}
                              aria-rowindex={r + 1}
                              aria-colindex={c + 1}
                              aria-label={t('cellAria', { row: r, col: c, pct: formatPercent(p) })}
                              title={`${lat(r)}°N, ${lon(c)}°E`}
                              onClick={() => onCellSelect({ row: r, col: c })}
                              className={cn(
                                'flex aspect-square items-center justify-center rounded-md font-display text-[11px] font-semibold tabular transition-[transform,filter,box-shadow] duration-150 outline-none sm:rounded-lg sm:text-xs',
                                cellClassFor(p),
                                isSelected
                                  ? 'z-10 scale-[1.08] shadow-lg ring-2 ring-fg ring-offset-2 ring-offset-surface-sunken'
                                  : 'hover:z-10 hover:scale-[1.04] hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ring',
                              )}
                            >
                              {formatPercent(p)}
                            </button>
                          )
                        }),
                      )}
                </div>
              </div>
              <div className="mt-1.5 flex justify-between pl-9 font-mono text-[9px] text-fg-subtle tabular sm:text-[10px]" aria-hidden>
                {Array.from({ length: cols }, (_, c) => (
                  <span key={c}>{lon(c)}</span>
                ))}
              </div>
              <div className="mt-1 text-center text-[10px] font-semibold tracking-wide text-fg-subtle uppercase">{t('south')}</div>
            </div>
          </div>
        )}

        {/* Inspector for the selected cell + keyboard-friendly nudge pad */}
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-raised p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <div className="flex min-w-0 items-center gap-3">
            {selected ? (
              <>
                <div className={cn('font-display text-3xl font-bold tabular', RISK_TEXT_CLASS[selected.risk_level])}>
                  {formatPercent(selected.probability, 1)}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold tracking-wider text-fg-subtle uppercase">{t('selectedCell')}</p>
                  <div className="flex items-center gap-2">
                    <span className="font-display text-sm font-semibold tabular">
                      {selected.row},{selected.col}
                    </span>
                    <Badge variant={RISK_BADGE_VARIANT[selected.risk_level]} size="sm">
                      {tr(selected.risk_level)}
                    </Badge>
                  </div>
                  <div className="truncate font-mono text-[11px] text-fg-subtle">
                    {selected.latitude}°N, {selected.longitude}°E
                  </div>
                </div>
              </>
            ) : (
              <>
                <Skeleton className="h-9 w-16" />
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-28" />
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-3 self-end sm:self-auto">
            <span className="hidden text-[11px] text-fg-subtle 2xl:block">{t('useArrows')}</span>
            <div className="grid grid-cols-3 gap-0.5" role="group" aria-label={t('nudge')}>
              <span />
              <Button variant="subtle" size="icon-sm" aria-label={t('moveUp')} disabled={selectedCell.row === 0} onClick={() => move(-1, 0)}>
                <ChevronUp />
              </Button>
              <span />
              <Button variant="subtle" size="icon-sm" aria-label={t('moveLeft')} disabled={selectedCell.col === 0} onClick={() => move(0, -1)}>
                <ChevronLeft />
              </Button>
              <Button variant="subtle" size="icon-sm" aria-label={t('moveDown')} disabled={selectedCell.row === rows - 1} onClick={() => move(1, 0)}>
                <ChevronDown />
              </Button>
              <Button variant="subtle" size="icon-sm" aria-label={t('moveRight')} disabled={selectedCell.col === cols - 1} onClick={() => move(0, 1)}>
                <ChevronRight />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex-col items-stretch gap-3">
        <Legend t={t} />
        <p className="font-mono text-[10px] text-fg-subtle">{t('bbox')}</p>
      </CardFooter>
    </Card>
  )
}
