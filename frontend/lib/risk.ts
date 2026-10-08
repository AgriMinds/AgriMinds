import type { DroughtMapResponse, GridCellRisk, RiskLevel } from '@agriminds/api-types'
import { RISK_LEVELS, riskLevelFor } from '@agriminds/api-types'

export { riskLevelFor, RISK_LEVELS }

/** Solid cell colour for the grid map (background + readable foreground). */
export const RISK_CELL_CLASS: Record<RiskLevel, string> = {
  Low: 'bg-risk-low text-risk-low-fg',
  Moderate: 'bg-risk-moderate text-risk-moderate-fg',
  High: 'bg-risk-high text-risk-high-fg',
  Severe: 'bg-risk-severe text-risk-severe-fg',
}

/** Soft panel treatment. */
export const RISK_SOFT_CLASS: Record<RiskLevel, string> = {
  Low: 'bg-risk-low-soft',
  Moderate: 'bg-risk-moderate-soft',
  High: 'bg-risk-high-soft',
  Severe: 'bg-risk-severe-soft',
}

export const RISK_ACCENT_BORDER: Record<RiskLevel, string> = {
  Low: 'border-l-risk-low',
  Moderate: 'border-l-risk-moderate',
  High: 'border-l-risk-high',
  Severe: 'border-l-risk-severe',
}

export const RISK_DOT_CLASS: Record<RiskLevel, string> = {
  Low: 'bg-risk-low',
  Moderate: 'bg-risk-moderate',
  High: 'bg-risk-high',
  Severe: 'bg-risk-severe',
}

export const RISK_TEXT_CLASS: Record<RiskLevel, string> = {
  Low: 'text-risk-low',
  Moderate: 'text-risk-moderate',
  High: 'text-risk-high',
  Severe: 'text-risk-severe',
}

export const RISK_BADGE_VARIANT: Record<RiskLevel, 'low' | 'moderate' | 'high' | 'severe'> = {
  Low: 'low',
  Moderate: 'moderate',
  High: 'high',
  Severe: 'severe',
}

export function cellClassFor(probability: number): string {
  return RISK_CELL_CLASS[riskLevelFor(probability)]
}

export type EnsoPhase = 'warm' | 'cool' | 'neutral'
export function ensoPhase(nino34: number): EnsoPhase {
  if (nino34 >= 0.5) return 'warm'
  if (nino34 <= -0.5) return 'cool'
  return 'neutral'
}

/** Derived headline figures for the KPI strip. */
export function summarize(map: DroughtMapResponse | undefined) {
  if (!map) return undefined
  let highest: GridCellRisk | undefined
  let atRisk = 0
  let total = 0
  // Only the cells inside the catchment count: the bounding box also covers ground that is not
  // in the basin, and a reading there is not a statement about this watershed.
  for (const c of map.cells) {
    if (c.in_watershed === false) continue
    total += 1
    if (!highest || c.probability > highest.probability) highest = c
    if (c.risk_level === 'High' || c.risk_level === 'Severe') atRisk += 1
  }
  return { highest, atRisk, total }
}
