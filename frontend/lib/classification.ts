/**
 * Styling for the two research classifications of Table 2 (Megbar & Tadesse 2016;
 * Menberu & Addisu 2018).
 *
 * The server does the classifying — it owns the thresholds and returns the band. Nothing here
 * re-derives a band from a number, so the UI can never disagree with the API about where a
 * boundary sits.
 *
 * The Sc-PDSI scale and the forecast risk ramp are deliberately different visual languages:
 *   risk     — saturated green → amber → orange → red, no neutral, "how likely is drought next season"
 *   Sc-PDSI  — earth brown ↔ neutral grey ↔ water blue, midpoint lightest, "how dry is the ground now"
 * They also carry different units (% versus a signed index) and their own icons, so colour is
 * never the only thing telling them apart.
 */
import {
  CloudDrizzle,
  CloudRain,
  CloudRainWind,
  Equal,
  Flame,
  Snowflake,
  Sun,
  SunDim,
  ThermometerSun,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import type { EnsoCategory, PdsiCategory } from '@agriminds/api-types'
import {
  ENSO_CATEGORIES,
  PDSI_CATEGORIES,
  PDSI_DRY_CATEGORIES,
  isEnsoExtreme,
  isPdsiDrought,
} from '@agriminds/api-types'

export { ENSO_CATEGORIES, PDSI_CATEGORIES, PDSI_DRY_CATEGORIES, isEnsoExtreme, isPdsiDrought }
export type { EnsoCategory, PdsiCategory }

type Icon = typeof Sun

/** Solid fill plus the text colour verified to clear 4.5:1 against it. */
export const PDSI_CELL_CLASS: Record<PdsiCategory, string> = {
  'Extremely dry': 'bg-pdsi-extremely-dry text-pdsi-paper',
  'Very dry': 'bg-pdsi-very-dry text-pdsi-paper',
  'Moderately dry': 'bg-pdsi-moderately-dry text-pdsi-ink',
  Normal: 'bg-pdsi-normal text-pdsi-ink',
  'Moderately wet': 'bg-pdsi-moderately-wet text-pdsi-ink',
  'Very wet': 'bg-pdsi-very-wet text-pdsi-paper',
  'Extremely wet': 'bg-pdsi-extremely-wet text-pdsi-paper',
}

/** Swatch only, for legends and inline dots. */
export const PDSI_DOT_CLASS: Record<PdsiCategory, string> = {
  'Extremely dry': 'bg-pdsi-extremely-dry',
  'Very dry': 'bg-pdsi-very-dry',
  'Moderately dry': 'bg-pdsi-moderately-dry',
  Normal: 'bg-pdsi-normal',
  'Moderately wet': 'bg-pdsi-moderately-wet',
  'Very wet': 'bg-pdsi-very-wet',
  'Extremely wet': 'bg-pdsi-extremely-wet',
}

/** Icon per band, so the scale survives greyscale, colour blindness and forced colours. */
export const PDSI_ICON: Record<PdsiCategory, Icon> = {
  'Extremely dry': Flame,
  'Very dry': Sun,
  'Moderately dry': SunDim,
  Normal: Equal,
  'Moderately wet': CloudDrizzle,
  'Very wet': CloudRain,
  'Extremely wet': CloudRainWind,
}

/** Driest = 0 … wettest = 6. Lets a list or legend be ordered without re-deriving the scale. */
export const PDSI_ORDER: Record<PdsiCategory, number> = Object.fromEntries(
  PDSI_CATEGORIES.map((c, i) => [c, i]),
) as Record<PdsiCategory, number>

/** Message key for a band, e.g. `pdsi.extremelyDry`. */
export function pdsiKey(category: PdsiCategory): string {
  const [first, ...rest] = category.split(' ')
  return first!.toLowerCase() + rest.map((w) => w[0]!.toUpperCase() + w.slice(1)).join('')
}

// ---------------------------------------------------------------- ENSO bands
export const ENSO_TEXT_CLASS: Record<EnsoCategory, string> = {
  'High El Niño': 'text-enso-warm',
  'Moderate El Niño': 'text-enso-warm',
  Neutral: 'text-primary',
  'Moderate La Niña': 'text-enso-cool',
  'High La Niña': 'text-enso-cool',
}

export const ENSO_BADGE_VARIANT: Record<EnsoCategory, 'bad' | 'warn' | 'ok' | 'default'> = {
  'High El Niño': 'bad',
  'Moderate El Niño': 'warn',
  Neutral: 'ok',
  'Moderate La Niña': 'default',
  'High La Niña': 'default',
}

export const ENSO_ICON: Record<EnsoCategory, Icon> = {
  'High El Niño': Flame,
  'Moderate El Niño': TrendingUp,
  Neutral: ThermometerSun,
  'Moderate La Niña': TrendingDown,
  'High La Niña': Snowflake,
}

/** La Niña = 0 … El Niño = 4, matching the order the gauge is drawn in. */
export const ENSO_ORDER: Record<EnsoCategory, number> = Object.fromEntries(
  ENSO_CATEGORIES.map((c, i) => [c, i]),
) as Record<EnsoCategory, number>

/** Message key for a band, e.g. `ensoBand.highElNino`. */
export function ensoKey(category: EnsoCategory): string {
  const words = category.normalize('NFD').replace(/[̀-ͯ]/g, '').split(' ')
  return words[0]!.toLowerCase() + words.slice(1).map((w) => w[0]!.toUpperCase() + w.slice(1)).join('')
}

/** Signed index value as shown to a reader: "+1.8", "-2.3", "0.0". */
export function formatPdsi(value: number): string {
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(1)}`
}
