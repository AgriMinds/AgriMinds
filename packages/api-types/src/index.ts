/**
 * Friendly aliases over the generated OpenAPI schema.
 * Regenerate with `make api-types` (exports backend OpenAPI -> openapi.json -> schema.d.ts).
 * Do not hand-edit schema.d.ts.
 */
import type { components, operations, paths } from './schema'

export type { components, operations, paths }

type Schemas = components['schemas']

export type Crop = Schemas['AdvisoryRequest']['crop']
export type RiskLevel = Schemas['GridCellRisk']['risk_level']
export type ForecastProvenance = Schemas['ForecastProvenance']

export type GridCellRisk = Schemas['GridCellRisk']
export type DroughtMapResponse = Schemas['DroughtMapResponse']
export type CellRiskQuery = Schemas['CellRiskQuery']
export type CellRiskResponse = Schemas['CellRiskResponse']

export type AdvisoryRequest = Schemas['AdvisoryRequest']
export type AdvisoryResponse = Schemas['AdvisoryResponse']

export type EnsoPoint = Schemas['EnsoPoint']
export type EnsoOutlookResponse = Schemas['EnsoOutlookResponse']

export type HealthResponse = Schemas['HealthResponse']
export type HealthStatus = HealthResponse['status']
export type ErrorResponse = Schemas['ErrorResponse']

export const CROPS = ['tef', 'wheat', 'maize'] as const satisfies readonly Crop[]
export const RISK_LEVELS = ['Low', 'Moderate', 'High', 'Severe'] as const satisfies readonly RiskLevel[]
export const LEAD_MONTHS = [1, 2, 3] as const
export type LeadMonth = (typeof LEAD_MONTHS)[number]

/** Thresholds mirror ai_drews.advisory.rules.RISK_LEVELS; used only for colouring, never for decisions. */
export const RISK_THRESHOLDS: ReadonlyArray<{ below: number; level: RiskLevel }> = [
  { below: 0.25, level: 'Low' },
  { below: 0.45, level: 'Moderate' },
  { below: 0.65, level: 'High' },
  { below: 1.01, level: 'Severe' },
]

export function riskLevelFor(probability: number): RiskLevel {
  return RISK_THRESHOLDS.find((t) => probability < t.below)?.level ?? 'Severe'
}

export const API_V1_PREFIX = '/api/v1'
