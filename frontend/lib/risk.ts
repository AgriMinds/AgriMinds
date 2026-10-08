import type { RiskLevel } from '@agriminds/api-types'
import { riskLevelFor } from '@agriminds/api-types'

export { riskLevelFor }

/** Solid cell colour for the grid map (background + readable foreground). */
export const RISK_CELL_CLASS: Record<RiskLevel, string> = {
  Low: 'bg-risk-low text-white hover:brightness-110',
  Moderate: 'bg-risk-moderate text-brand-forest-deep hover:brightness-105',
  High: 'bg-risk-high text-white hover:brightness-110',
  Severe: 'bg-risk-severe text-white hover:brightness-110',
}

/** Soft badge/panel treatment. */
export const RISK_SOFT_CLASS: Record<RiskLevel, string> = {
  Low: 'bg-risk-low-soft text-fg border-risk-low/40',
  Moderate: 'bg-risk-moderate-soft text-fg border-risk-moderate/50',
  High: 'bg-risk-high-soft text-fg border-risk-high/50',
  Severe: 'bg-risk-severe-soft text-fg border-risk-severe/50',
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

export function cellClassFor(probability: number): string {
  return RISK_CELL_CLASS[riskLevelFor(probability)]
}

export type EnsoPhase = 'warm' | 'cool' | 'neutral'
export function ensoPhase(nino34: number): EnsoPhase {
  if (nino34 >= 0.5) return 'warm'
  if (nino34 <= -0.5) return 'cool'
  return 'neutral'
}
