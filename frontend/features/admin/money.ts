/**
 * Display formatting for money the API has already rendered.
 *
 * The server sends every amount twice: `annual_cents` for arithmetic and `annual` as a decimal
 * string for display. These helpers only ever touch the decimal string, so the client never
 * divides minor units and never recreates the rounding bug the two-field contract exists to
 * prevent. Grouping a figure like 4500000.00 into 4,500,000 is presentation, not arithmetic.
 */

export function formatMoney(amount: string, currency: string, locale = 'en-ET'): string {
  const value = Number(amount)
  if (!Number.isFinite(value)) return amount
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    // Whole birr for anything above a birr; santim only where they carry meaning, as they do
    // for the farmer tier at 0.41 a day.
    minimumFractionDigits: value < 1 ? 2 : 0,
    maximumFractionDigits: value < 1 ? 2 : 0,
  }).format(value)
}

/** Compact form for a KPI tile: ETB 4.5M rather than ETB 4,500,000. */
export function formatCompact(amount: string, currency: string, locale = 'en-ET'): string {
  const value = Number(amount)
  if (!Number.isFinite(value)) return amount
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

export function formatRequests(n: number, locale = 'en-ET'): string {
  return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 0 }).format(n)
}
