'use client'

import { useCallback, useRef, useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Compass, Map as MapIcon, Sprout } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { DroughtMapResponse, GridCellRisk, LeadMonth, PdsiCategory, RiskLevel } from '@agriminds/api-types'
import { RISK_THRESHOLDS } from '@agriminds/api-types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardActions,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardHeading,
  CardIcon,
  CardTitle,
} from '@/components/ui/card'
import { QueryError } from '@/components/ui/query-state'
import { SegmentedControl } from '@/components/ui/segmented'
import { Skeleton } from '@/components/ui/skeleton'
import { PDSI_CATEGORIES, PDSI_CELL_CLASS, PDSI_DOT_CLASS, formatPdsi, pdsiKey } from '@/lib/classification'
import { RISK_BADGE_VARIANT, RISK_DOT_CLASS, RISK_TEXT_CLASS, cellClassFor } from '@/lib/risk'
import { cn, formatPercent } from '@/lib/utils'

export type Cell = { row: number; col: number }

/**
 * The grid can show two different quantities, and they must never be read as the same thing:
 *   risk    — modelled probability of drought NEXT season, in %
 *   dryness — Sc-PDSI measured for the issue month, a signed index of how dry the ground IS
 * They get separate colour scales, separate units, separate legends and separate labels.
 */
type Mode = 'risk' | 'dryness'

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

/** Forecast legend: four segments sized by the probability range each level covers. */
function RiskLegend({ t }: { t: ReturnType<typeof useTranslations<'grid'>> }) {
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

/** Dryness legend: the diverging scale, driest on the left, with its neutral centre marked. */
function DrynessLegend() {
  const t = useTranslations('grid')
  const tp = useTranslations('pdsi')
  return (
    <div className="w-full">
      <div className="flex h-2 w-full overflow-hidden rounded-full" aria-label={tp('scaleAria')} role="img">
        {PDSI_CATEGORIES.map((c) => (
          <span key={c} className={cn('flex-1', PDSI_DOT_CLASS[c])} />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] font-semibold text-fg-subtle">
        <span>{tp('dryEnd')}</span>
        <span>{tp('normal')}</span>
        <span>{tp('wetEnd')}</span>
      </div>
      <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-fg-muted">
        {PDSI_CATEGORIES.map((c) => (
          <li key={c} className="flex items-center gap-1.5">
            <span className={cn('size-2 rounded-full', PDSI_DOT_CLASS[c])} aria-hidden />
            {tp(pdsiKey(c))}
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-[11px] text-fg-subtle">{t('drynessLegend')}</p>
    </div>
  )
}

export function WatershedGridMap({
  mapData,
  isLoading,
  isFetching,
  error,
  onRetry,
  selectedLead,
  selectedCell,
  onCellSelect,
}: Props) {
  const t = useTranslations('grid')
  const tr = useTranslations('risk')
  const tp = useTranslations('pdsi')
  const gridRef = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState<Mode>('risk')

  const [rows, cols] = mapData?.grid_shape ?? [8, 8]
  const [lonMin, latMin, lonMax, latMax] = mapData?.bbox ?? [37.6, 10.4, 38.4, 11.2]

  // Ground measurements only exist when the server had a climate record to compute them from.
  const hasDryness = Boolean(mapData?.conditions)
  const active: Mode = hasDryness ? mode : 'risk'

  const byCell = new Map<string, GridCellRisk>((mapData?.cells ?? []).map((c) => [`${c.row}-${c.col}`, c]))
  const selected = byCell.get(`${selectedCell.row}-${selectedCell.col}`)

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
  const bandName = (c?: PdsiCategory | null) => (c ? tp(pdsiKey(c)) : '')

  return (
    <Card className="h-full">
      <CardHeader>
        <CardHeading>
          <CardIcon>{active === 'risk' ? <MapIcon /> : <Sprout />}</CardIcon>
          <div className="min-w-0">
            <CardTitle>{active === 'risk' ? t('title') : t('drynessTitle')}</CardTitle>
            <CardDescription>
              {active === 'risk' ? t('probabilityOfDrought') : t('drynessSubtitle')}
            </CardDescription>
          </div>
        </CardHeading>
        <CardActions className="flex-wrap">
          {active === 'risk' && <Badge variant="outline">{t(`lead${selectedLead}` as 'lead1' | 'lead2' | 'lead3')}</Badge>}
          {mapData && (
            <Badge variant="default">{active === 'risk' ? mapData.target_date : mapData.conditions?.as_of}</Badge>
          )}
        </CardActions>
      </CardHeader>

      <CardContent>
        {hasDryness && (
          <SegmentedControl<Mode>
            aria-label={t('modeGroup')}
            value={active}
            onChange={setMode}
            size="sm"
            className="self-start"
            options={[
              { value: 'risk', label: t('modeRisk') },
              { value: 'dryness', label: t('modeDryness') },
            ]}
          />
        )}

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
                  aria-label={active === 'risk' ? t('title') : t('drynessTitle')}
                  aria-rowcount={rows}
                  aria-colcount={cols}
                  onKeyDown={onKeyDown}
                  className="grid gap-1 sm:gap-1.5"
                  style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
                >
                  {isLoading && !mapData
                    ? Array.from({ length: rows * cols }, (_, i) => <Skeleton key={i} className="aspect-square rounded-md" />)
                    : Array.from({ length: rows }, (_, r) =>
                        Array.from({ length: cols }, (_, c) => {
                          const cell = byCell.get(`${r}-${c}`)
                          if (!cell) return <span key={`${r}-${c}`} />
                          const isSelected = r === selectedCell.row && c === selectedCell.col
                          const dry = active === 'dryness' && cell.pdsi != null && cell.pdsi_category != null
                          return (
                            <button
                              key={`${r}-${c}`}
                              type="button"
                              role="gridcell"
                              data-cell={`${r}-${c}`}
                              data-mode={active}
                              tabIndex={isSelected ? 0 : -1}
                              aria-selected={isSelected}
                              aria-rowindex={r + 1}
                              aria-colindex={c + 1}
                              aria-label={
                                dry
                                  ? t('cellAriaDryness', {
                                      row: r,
                                      col: c,
                                      value: formatPdsi(cell.pdsi!),
                                      band: bandName(cell.pdsi_category),
                                    })
                                  : t('cellAria', { row: r, col: c, pct: formatPercent(cell.probability) })
                              }
                              title={`${lat(r)}°N, ${lon(c)}°E`}
                              onClick={() => onCellSelect({ row: r, col: c })}
                              className={cn(
                                'flex aspect-square items-center justify-center rounded-md font-display text-[11px] font-semibold tabular transition-[transform,filter,box-shadow] duration-150 outline-none sm:rounded-lg sm:text-xs',
                                dry ? PDSI_CELL_CLASS[cell.pdsi_category!] : cellClassFor(cell.probability),
                                isSelected
                                  ? 'z-10 scale-[1.08] shadow-lg ring-2 ring-fg ring-offset-2 ring-offset-surface-sunken'
                                  : 'hover:z-10 hover:scale-[1.04] hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ring',
                              )}
                            >
                              {dry ? formatPdsi(cell.pdsi!) : formatPercent(cell.probability)}
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

        {/* Inspector: both quantities side by side, each with its own label, so neither can be
            mistaken for the other regardless of which mode the grid is in. */}
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-raised p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <div className="flex min-w-0 flex-col gap-2">
            {selected ? (
              <>
                <div>
                  <p className="text-[10px] font-semibold tracking-wider text-fg-subtle uppercase">{t('selectedCell')}</p>
                  <div className="flex items-center gap-2">
                    <span className="font-display text-sm font-semibold tabular">
                      {selected.row},{selected.col}
                    </span>
                    <span className="truncate font-mono text-[11px] text-fg-subtle">
                      {selected.latitude}°N, {selected.longitude}°E
                    </span>
                  </div>
                </div>
                <dl data-testid="cell-inspector" className="flex flex-wrap items-end gap-x-6 gap-y-2">
                  <div>
                    <dt className="text-[11px] text-fg-subtle">{t('forecastLabel')}</dt>
                    <dd className="flex items-baseline gap-2">
                      <span className={cn('font-display text-2xl font-bold tabular', RISK_TEXT_CLASS[selected.risk_level])}>
                        {formatPercent(selected.probability, 1)}
                      </span>
                      <Badge variant={RISK_BADGE_VARIANT[selected.risk_level]} size="sm">
                        {tr(selected.risk_level)}
                      </Badge>
                    </dd>
                  </div>
                  {selected.pdsi != null && selected.pdsi_category != null && (
                    <div>
                      <dt className="text-[11px] text-fg-subtle">{t('drynessLabel')}</dt>
                      <dd className="flex items-baseline gap-2">
                        <span className="font-display text-2xl font-bold tabular">{formatPdsi(selected.pdsi)}</span>
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                            PDSI_CELL_CLASS[selected.pdsi_category],
                          )}
                        >
                          {bandName(selected.pdsi_category)}
                        </span>
                      </dd>
                    </div>
                  )}
                </dl>
              </>
            ) : (
              <>
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-9 w-32" />
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
        {active === 'risk' ? <RiskLegend t={t} /> : <DrynessLegend />}
        <p className="font-mono text-[10px] text-fg-subtle">{t('bbox')}</p>
      </CardFooter>
    </Card>
  )
}
