'use client'

import type { PdsiCategory } from '@agriminds/api-types'
import { useDroughtMap } from '@/features/drought/useDroughtMap'

/**
 * Look up the measured ground condition for a plot's grid cell.
 *
 * The Sc-PDSI value the API returns describes the issue month, so it is the same whichever
 * forecast lead is being viewed; lead 1 is used purely to reuse the cached grid query. The
 * band comes from the server — nothing here re-derives it from the number.
 */
export function useGroundConditions() {
  const map = useDroughtMap(1)
  const byCell = new Map<string, PdsiCategory>(
    (map.data?.cells ?? [])
      .filter((c) => c.pdsi_category != null)
      .map((c) => [`${c.row}-${c.col}`, c.pdsi_category!]),
  )
  return {
    conditions: map.data?.conditions ?? null,
    groundFor: (row: number, col: number): PdsiCategory | null => byCell.get(`${row}-${col}`) ?? null,
  }
}
