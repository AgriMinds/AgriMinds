'use client'

import { useRef, useState } from 'react'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Compass,
  Map as MapIcon,
  Sprout,
} from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import type {
  DroughtMapResponse,
  GridCellRisk,
  LeadMonth,
  PdsiCategory,
  RiskLevel,
  WatershedBoundary,
} from '@agriminds/api-types'
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
import { CatchmentOutline } from '@/features/drought/CatchmentOutline'
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
  /** The surveyed outline. Absent on a deployment that has none; the grid then draws plain. */
  boundary?: WatershedBoundary
  isLoading: boolean
  isFetching: boolean
  error: unknown
  onRetry: () => void
  selectedLead: LeadMonth
  selectedCell: Cell
  onCellSelect: (cell: Cell) => void
}

const LEVELS: RiskLevel[] = ['Low', 'Moderate', 'High', 'Severe']

/** Shown under either legend: what a hatched, valueless cell means. */
function OutsideBasinKey({ label }: { label: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <span className="outside-basin size-2.5 rounded-sm border border-border-strong" aria-hidden />
      {label}
    </li>
  )
}

/** Forecast legend: four segments sized by the probability range each level covers. */
function RiskLegend({ t }: { t: ReturnType<typeof useTranslations<'grid'>> }) {
  const stops = [0, ...RISK_THRESHOLDS.slice(0, 3).map((r) => r.below), 1]
  return (
    <div className="w-full">
      <div className="flex h-2 w-full overflow-hidden rounded-full" aria-hidden>
        {LEVELS.map((lvl, i) => (
          <span
            key={lvl}
            className={cn(RISK_DOT_CLASS[lvl])}
            style={{ flexGrow: stops[i + 1]! - stops[i]! }}
          />
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
        <OutsideBasinKey label={t('outsideBasin')} />
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
        <OutsideBasinKey label={t('outsideBasin')} />
      </ul>
      <p className="mt-1.5 text-[11px] text-fg-subtle">{t('drynessLegend')}</p>
    </div>
  )
}

export function WatershedGridMap({
  mapData,
  boundary,
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
  const format = useFormatter()
  const gridRef = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState<Mode>('risk')

  const [rows, cols] = mapData?.grid_shape ?? (boundary ? [boundary.grid.rows, boundary.grid.cols] : [8, 8])
  const bbox = mapData?.bbox ?? boundary?.bbox ?? [37.0078, 9.84375, 38.53125, 11.26234]
  const [lonMin, latMin, lonMax, latMax] = bbox

  // Ground measurements only exist when the server had a climate record to compute them from.
  const hasDryness = Boolean(mapData?.conditions)
  const active: Mode = hasDryness ? mode : 'risk'

  const cells = mapData?.cells ?? []
  const byCell = new Map<string, GridCellRisk>(cells.map((c) => [`${c.row}-${c.col}`, c]))
  const selected = byCell.get(`${selectedCell.row}-${selectedCell.col}`)

  // The catchment is irregular: of the 64 cells in the bounding box, 49 are in the basin. The
  // flag travels with every cell, so muting works even where no outline is configured to draw.
  // A cell the server said nothing about is treated as in-basin, which is the old plain grid.
  const isInside = (row: number, col: number) => byCell.get(`${row}-${col}`)?.in_watershed !== false
  const insideCount = cells.filter((c) => c.in_watershed).length || rows * cols
  const selectedInside = isInside(selectedCell.row, selectedCell.col)

  /** The next in-basin cell along a direction, continuing past muted cells. Null if there is none. */
  const seek = (dr: number, dc: number): Cell | null => {
    let { row, col } = selectedCell
    for (let i = 0; i < Math.max(rows, cols); i++) {
      row += dr
      col += dc
      if (row < 0 || col < 0 || row >= rows || col >= cols) return null
      if (isInside(row, col)) return { row, col }
    }
    return null
  }

  const move = (dr: number, dc: number) => {
    const next = seek(dr, dc)
    if (!next) return
    onCellSelect(next)
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-cell="${next.row}-${next.col}"]`)?.focus()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    const d: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    }
    const delta = d[e.key]
    if (!delta) return
    e.preventDefault()
    move(...delta)
  }

  // Exactly one cell carries tabIndex 0. If the selection sits outside the basin it is not a
  // button, so the roving focus falls to the first cell that is, and the grid stays reachable.
  const firstInside = cells.find((c) => c.in_watershed)
  const focusCell =
    selectedInside || !firstInside ? selectedCell : { row: firstInside.row, col: firstInside.col }

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
          {active === 'risk' && (
            <Badge variant="outline">{t(`lead${selectedLead}` as 'lead1' | 'lead2' | 'lead3')}</Badge>
          )}
          {mapData && (
            <Badge variant="default">
              {active === 'risk' ? mapData.target_date : mapData.conditions?.as_of}
            </Badge>
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
                <div
                  className="flex flex-col justify-around pr-1 font-mono text-[9px] text-fg-subtle tabular sm:text-[10px]"
                  aria-hidden
                >
                  {Array.from({ length: rows }, (_, r) => (
                    <span key={r} className="text-right leading-none">
                      {lat(r)}
                    </span>
                  ))}
                </div>
                {/* The outline is a sibling of the grid and covers it exactly: the grid has no
                    padding and no gap, so its content box is the rows x cols frame the SVG
                    projects into. Cells inset themselves with a margin to keep the visual gap. */}
                <div className="relative min-w-0">
                  <div
                    ref={gridRef}
                    role="grid"
                    aria-label={active === 'risk' ? t('title') : t('drynessTitle')}
                    aria-rowcount={rows}
                    aria-colcount={cols}
                    onKeyDown={onKeyDown}
                    className="grid gap-0"
                    style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
                  >
                    {isLoading && !mapData
                      ? Array.from({ length: rows * cols }, (_, i) => (
                          <Skeleton key={i} className="m-[1.5px] aspect-square rounded-md sm:m-[3px]" />
                        ))
                      : Array.from({ length: rows }, (_, r) =>
                          Array.from({ length: cols }, (_, c) => {
                            const cell = byCell.get(`${r}-${c}`)
                            if (!cell) return <span key={`${r}-${c}`} />
                            const inside = cell.in_watershed !== false

                            // Outside the basin: no value, no colour from either scale, not
                            // selectable. A hatch reads as "not surveyed here" where a pale fill
                            // would read as a low number on whichever scale is showing.
                            if (!inside) {
                              return (
                                <div
                                  key={`${r}-${c}`}
                                  role="gridcell"
                                  data-cell={`${r}-${c}`}
                                  data-outside="true"
                                  aria-disabled
                                  aria-rowindex={r + 1}
                                  aria-colindex={c + 1}
                                  aria-label={t('cellAriaOutside', { row: r, col: c })}
                                  title={t('outsideBasin')}
                                  className="outside-basin m-[1.5px] aspect-square rounded-md opacity-70 sm:m-[3px] sm:rounded-lg"
                                />
                              )
                            }

                            const isSelected = r === selectedCell.row && c === selectedCell.col
                            const dry =
                              active === 'dryness' && cell.pdsi != null && cell.pdsi_category != null
                            return (
                              <button
                                key={`${r}-${c}`}
                                type="button"
                                role="gridcell"
                                data-cell={`${r}-${c}`}
                                data-mode={active}
                                tabIndex={r === focusCell.row && c === focusCell.col ? 0 : -1}
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
                                  'm-[1.5px] flex aspect-square items-center justify-center rounded-md font-display text-[11px] font-semibold tabular transition-[transform,filter,box-shadow] duration-150 outline-none sm:m-[3px] sm:rounded-lg sm:text-xs',
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
                  {boundary && !(isLoading && !mapData) && (
                    <CatchmentOutline
                      boundary={boundary}
                      bbox={bbox as [number, number, number, number]}
                      rows={rows}
                      cols={cols}
                      label={t('outlineAria', { name: boundary.name })}
                    />
                  )}
                </div>
              </div>
              <div
                className="mt-1.5 flex justify-between pl-9 font-mono text-[9px] text-fg-subtle tabular sm:text-[10px]"
                aria-hidden
              >
                {Array.from({ length: cols }, (_, c) => (
                  <span key={c}>{lon(c)}</span>
                ))}
              </div>
              <div className="mt-1 text-center text-[10px] font-semibold tracking-wide text-fg-subtle uppercase">
                {t('south')}
              </div>
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
                  <p className="text-[10px] font-semibold tracking-wider text-fg-subtle uppercase">
                    {t('selectedCell')}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="font-display text-sm font-semibold tabular">
                      {selected.row},{selected.col}
                    </span>
                    <span className="truncate font-mono text-[11px] text-fg-subtle">
                      {selected.latitude}°N, {selected.longitude}°E
                    </span>
                  </div>
                </div>
                {selectedInside ? (
                  <dl data-testid="cell-inspector" className="flex flex-wrap items-end gap-x-6 gap-y-2">
                    <div>
                      <dt className="text-[11px] text-fg-subtle">{t('forecastLabel')}</dt>
                      <dd className="flex items-baseline gap-2">
                        <span
                          className={cn(
                            'font-display text-2xl font-bold tabular',
                            RISK_TEXT_CLASS[selected.risk_level],
                          )}
                        >
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
                          <span className="font-display text-2xl font-bold tabular">
                            {formatPdsi(selected.pdsi)}
                          </span>
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
                ) : (
                  <p data-testid="cell-outside" className="max-w-xs text-sm text-fg-muted">
                    {t('outsideSelected')}
                  </p>
                )}
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
              <Button
                variant="subtle"
                size="icon-sm"
                aria-label={t('moveUp')}
                disabled={!seek(-1, 0)}
                onClick={() => move(-1, 0)}
              >
                <ChevronUp />
              </Button>
              <span />
              <Button
                variant="subtle"
                size="icon-sm"
                aria-label={t('moveLeft')}
                disabled={!seek(0, -1)}
                onClick={() => move(0, -1)}
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="subtle"
                size="icon-sm"
                aria-label={t('moveDown')}
                disabled={!seek(1, 0)}
                onClick={() => move(1, 0)}
              >
                <ChevronDown />
              </Button>
              <Button
                variant="subtle"
                size="icon-sm"
                aria-label={t('moveRight')}
                disabled={!seek(0, 1)}
                onClick={() => move(0, 1)}
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex-col items-stretch gap-3">
        {active === 'risk' ? <RiskLegend t={t} /> : <DrynessLegend />}
        {/* Why cells are blank, and how much ground the grid actually covers. */}
        <p className="text-[11px] text-fg-muted">
          {t('basinCells', { inside: insideCount, total: rows * cols })}
          {boundary?.area_km2 != null && (
            <> · {t('basinArea', { area: format.number(Math.round(boundary.area_km2)) })}</>
          )}
        </p>
        <p className="font-mono text-[10px] text-fg-subtle">
          {t('bbox', {
            west: lonMin.toFixed(2),
            east: lonMax.toFixed(2),
            south: latMin.toFixed(2),
            north: latMax.toFixed(2),
          })}
        </p>
      </CardFooter>
    </Card>
  )
}
