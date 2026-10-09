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

/** Five-way Niño 3.4 band and seven-way Sc-PDSI drought intensity, Table 2 of the AI-DREWS study
 *  (Megbar & Tadesse 2016; Menberu & Addisu 2018). */
export type EnsoCategory = Schemas['EnsoOutlookResponse']['current_category']
export type PdsiCategory = NonNullable<Schemas['GridCellRisk']['pdsi_category']>
export type ObservedConditions = Schemas['ObservedConditions']

/** The surveyed Choke Mountain Watershed outline (18,948 km2) and which grid cells fall in it. */
export type WatershedBoundary = Schemas['WatershedBoundary']
export type WatershedGrid = Schemas['WatershedGrid']

/** What the forecast is actually built from, reported from disk rather than a fixed list. */
export type DataInventory = Schemas['DataInventory']
export type DataSource = Schemas['DataSource']
export type SourceStatus = DataSource['status']

export const ENSO_CATEGORIES = [
  'High La Niña',
  'Moderate La Niña',
  'Neutral',
  'Moderate El Niño',
  'High El Niño',
] as const satisfies readonly EnsoCategory[]

/** Driest to wettest, so a scale can be rendered in order. */
export const PDSI_CATEGORIES = [
  'Extremely dry',
  'Very dry',
  'Moderately dry',
  'Normal',
  'Moderately wet',
  'Very wet',
  'Extremely wet',
] as const satisfies readonly PdsiCategory[]

export const PDSI_DRY_CATEGORIES = ['Moderately dry', 'Very dry', 'Extremely dry'] as const
export function isPdsiDrought(category: PdsiCategory): boolean {
  return (PDSI_DRY_CATEGORIES as readonly PdsiCategory[]).includes(category)
}
export function isEnsoExtreme(category: EnsoCategory): boolean {
  return category === 'High El Niño' || category === 'High La Niña'
}
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

// ---- accounts, farms and dashboards -------------------------------------------------
export type Role = Schemas['UserOut']['role']
export type User = Schemas['UserOut']
export type LoginRequest = Schemas['LoginRequest']
export type TokenPair = Schemas['TokenPair']
export type AccessTokenOut = Schemas['AccessTokenOut']
export type Woreda = Schemas['WoredaOut']

export type Farm = Schemas['FarmOut']
export type FarmCreate = Schemas['FarmCreate']
export type FarmUpdate = Schemas['FarmUpdate']
export type FarmRisk = Schemas['FarmRisk']
export type FarmAdvisory = Schemas['FarmAdvisoryOut']

export type FarmerDashboard = Schemas['FarmerDashboard']
export type MinistryDashboard = Schemas['MinistryDashboard']
export type CoverageStats = Schemas['CoverageStats']
export type RiskExposure = Schemas['RiskExposure']
export type RiskBucket = Schemas['RiskBucket']
export type WoredaRisk = Schemas['WoredaRisk']
export type CropMixEntry = Schemas['CropMixEntry']
export type AdvisoryDelivery = Schemas['AdvisoryDelivery']

export const ROLES = ['farmer', 'agent', 'minister', 'admin'] as const satisfies readonly Role[]
/** Roles that reach the ministry dashboard; `farmer` gets the farm dashboard instead. */
export const STAFF_ROLES = ['agent', 'minister', 'admin'] as const satisfies readonly Role[]
export function isStaff(role: Role): boolean {
  return (STAFF_ROLES as readonly Role[]).includes(role)
}
/** Where a signed-in person lands. */
export function homePathFor(role: Role): '/farm' | '/ministry' {
  return role === 'farmer' ? '/farm' : '/ministry'
}

// ---- analytics (Power BI) ------------------------------------------------------------
export type MetabaseStatus = Schemas['MetabaseStatus']
export type EmbedConfig = Schemas['EmbedConfig']
export type AnalyticsConnection = Schemas['AnalyticsConnection']

export const API_V1_PREFIX = '/api/v1'
