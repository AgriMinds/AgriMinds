'use client'

import { Check, Minus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { AGRO_ZONES, CROPS, type Crop, type EnsoImpactResponse } from '@agriminds/api-types'
import { cn } from '@/lib/utils'

import { CropGlyph } from './CropArt'

/**
 * Section 2 — what El Niño years did to each crop in each belt.
 *
 * A signed percentage on a diverging scale: warm for a loss, cool for a gain, saturation by
 * magnitude. Nothing here reaches p < 0.05 on eight El Niño years, so significance is encoded as
 * well as stated — an unsupported cell is drawn hollow and its p-value sits under the number,
 * rather than a confident block of colour the record cannot back.
 *
 * Below `sm` the matrix becomes one block per crop: a 3x3 table at phone width would either
 * scroll sideways (losing the row label) or shrink the numbers past reading size.
 */
const LOSS = '#c67544'
const GAIN = '#2879b1'

/**
 * Colour carries the measure — direction and magnitude — and is applied to every cell, because
 * the effect is real whether or not the sample proves it. Confidence is a separate encoding:
 * a cell that misses p < 0.05 keeps a dashed outline and prints its p-value, and its fill is
 * held back so a confident cell always reads stronger than an unproven one of the same size.
 */
function tint(effect: number, maxAbs: number, significant: boolean): string {
  const share = Math.min(1, Math.abs(effect) / Math.max(maxAbs, 1))
  const strength = (significant ? 16 : 7) + share * (significant ? 44 : 20)
  return `color-mix(in oklab, ${effect < 0 ? LOSS : GAIN} ${strength}%, transparent)`
}

function Value({ effect, p, size = 'md' }: { effect: number; p: number; size?: 'md' | 'lg' }) {
  return (
    <>
      <span
        className={cn(
          'block font-display font-bold tabular-nums',
          size === 'lg' ? 'text-lg' : 'text-[15px] sm:text-base',
          effect < 0 ? 'text-risk-high' : 'text-primary',
        )}
      >
        {effect > 0 ? '+' : ''}
        {effect.toFixed(2)}%
      </span>
      <span className="block text-[10px] text-fg-subtle tabular-nums">p = {p.toFixed(3)}</span>
    </>
  )
}

export function ImpactMatrix({ data }: { data: EnsoImpactResponse }) {
  const t = useTranslations('cropYield.impact')
  const ta = useTranslations('advisory')
  const byKey = new Map(data.cells.map((c) => [`${c.crop}|${c.zone}`, c]))
  const byCrop = new Map(data.by_crop.map((g) => [g.key, g]))
  const byZone = new Map(data.by_zone.map((g) => [g.key, g]))
  const maxAbs = Math.max(...data.cells.map((c) => Math.abs(c.effect_pct)))

  const cropLabel = (crop: Crop) => (
    <span className="flex items-center gap-2">
      <CropGlyph crop={crop} className="size-5 shrink-0 text-fg-muted" />
      <span className="truncate font-semibold">{ta(`crops.${crop}.label`)}</span>
    </span>
  )

  return (
    <div className="flex flex-col gap-4">
      {/* Phone: one card per crop, three belts stacked inside it. */}
      <div className="flex flex-col gap-3 sm:hidden">
        {CROPS.map((crop) => (
          <div key={crop} className="rounded-xl border border-border bg-surface-raised p-3">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              {cropLabel(crop)}
              <span className="text-xs text-fg-muted tabular-nums">
                {t('average')} {(byCrop.get(crop)?.effect_pct ?? 0).toFixed(2)}%
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {AGRO_ZONES.map((zone) => {
                const cell = byKey.get(`${crop}|${zone}`)
                if (!cell) return <div key={zone} />
                return (
                  <div
                    key={zone}
                    className={cn(
                      'rounded-lg border px-1.5 py-2 text-center',
                      cell.significant ? 'border-transparent' : 'border-dashed border-border-strong',
                    )}
                    style={{ background: tint(cell.effect_pct, maxAbs, cell.significant) }}
                  >
                    <span className="block truncate text-[10px] font-medium text-fg-muted">{zone}</span>
                    <Value effect={cell.effect_pct} p={cell.p_value} />
                  </div>
                )
              })}
            </div>
          </div>
        ))}
        <div className="flex items-center justify-between rounded-xl bg-fg px-3 py-2 text-surface">
          <span className="text-xs font-semibold">{t('allCrops')}</span>
          <span className="font-display text-lg font-bold tabular-nums">
            {data.overall_effect_pct.toFixed(2)}%
          </span>
        </div>
      </div>

      {/* Tablet and up: the matrix proper. */}
      <table className="hidden w-full border-separate border-spacing-1.5 text-sm sm:table">
        <caption className="sr-only">{t('caption')}</caption>
        <thead>
          <tr>
            <th scope="col" className="text-left text-xs font-medium text-fg-muted">
              {t('crop')}
            </th>
            {AGRO_ZONES.map((zone) => (
              <th key={zone} scope="col" className="px-2 py-1 text-center">
                <span className="block text-xs font-semibold">{zone}</span>
                <span className="block text-[10px] font-normal text-fg-subtle">{t(`band.${zone}`)}</span>
              </th>
            ))}
            <th scope="col" className="px-2 py-1 text-center text-xs font-semibold">
              {t('average')}
            </th>
          </tr>
        </thead>
        <tbody>
          {CROPS.map((crop) => (
            <tr key={crop}>
              <th scope="row" className="py-1 pr-2 text-left whitespace-nowrap">
                {cropLabel(crop)}
              </th>
              {AGRO_ZONES.map((zone) => {
                const cell = byKey.get(`${crop}|${zone}`)
                if (!cell) return <td key={zone} />
                return (
                  <td
                    key={zone}
                    className={cn(
                      'rounded-lg border px-1 py-2 text-center transition-colors md:px-2',
                      cell.significant ? 'border-transparent' : 'border-dashed border-border-strong',
                    )}
                    style={{ background: tint(cell.effect_pct, maxAbs, cell.significant) }}
                  >
                    <Value effect={cell.effect_pct} p={cell.p_value} />
                  </td>
                )
              })}
              <td className="rounded-lg bg-surface-sunken px-1 py-2 text-center md:px-2">
                <span className="block font-display text-base font-bold tabular-nums">
                  {(byCrop.get(crop)?.effect_pct ?? 0) > 0 ? '+' : ''}
                  {(byCrop.get(crop)?.effect_pct ?? 0).toFixed(2)}%
                </span>
              </td>
            </tr>
          ))}
          <tr>
            <th scope="row" className="py-1 pr-2 text-left text-xs font-semibold text-fg-muted">
              {t('allCrops')}
            </th>
            {AGRO_ZONES.map((zone) => (
              <td key={zone} className="px-1 py-2 text-center text-sm font-semibold tabular-nums md:px-2">
                {(byZone.get(zone)?.effect_pct ?? 0).toFixed(2)}%
              </td>
            ))}
            <td className="rounded-lg bg-fg px-1 py-2 text-center md:px-2">
              <span className="block font-display text-base font-bold text-surface tabular-nums">
                {data.overall_effect_pct.toFixed(2)}%
              </span>
            </td>
          </tr>
        </tbody>
      </table>

      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-fg-muted">
        <li className="flex items-center gap-1.5">
          <span
            className="size-3 rounded-[3px]"
            style={{ background: tint(-maxAbs, maxAbs, true) }}
            aria-hidden
          />
          {t('legendLoss')}
        </li>
        <li className="flex items-center gap-1.5">
          <span
            className="size-3 rounded-[3px]"
            style={{ background: tint(maxAbs, maxAbs, true) }}
            aria-hidden
          />
          {t('legendGain')}
        </li>
        <li className="flex items-center gap-1.5">
          <span
            className="size-3 rounded-[3px] border border-dashed border-border-strong"
            style={{ background: tint(-maxAbs, maxAbs, false) }}
            aria-hidden
          />
          {t('legendNotSignificant')}
        </li>
      </ul>

      <div className="rounded-xl border border-status-warn/30 bg-status-warn/8 p-3 sm:p-3.5">
        <p className="mb-2 font-display text-sm font-bold">{t('takeawaysTitle')}</p>
        <ul className="flex flex-col gap-1.5 text-xs leading-relaxed text-fg-muted">
          {[
            t('takeawayOverall', { pct: Math.abs(data.overall_effect_pct).toFixed(2) }),
            t('takeawayWorst', {
              crop: ta(`crops.${data.cautions[0]?.crop ?? 'wheat'}.label`),
              zone: data.cautions[0]?.zone ?? 'Lowland',
              pct: Math.abs(data.cautions[0]?.effect_pct ?? 0).toFixed(2),
            }),
            t('takeawayBest', {
              crop: ta(`crops.${data.recommendations.find((r) => !r.still_negative)?.crop ?? 'maize'}.label`),
              zone: data.recommendations.find((r) => !r.still_negative)?.zone ?? 'Midland',
            }),
          ].map((line) => (
            <li key={line} className="flex gap-2">
              <Check className="mt-0.5 size-3.5 shrink-0 text-status-ok" aria-hidden />
              <span>{line}</span>
            </li>
          ))}
          <li className="flex gap-2 font-medium text-fg">
            <Minus className="mt-0.5 size-3.5 shrink-0 text-status-warn" aria-hidden />
            <span>
              {t('takeawaySignificance', {
                significant: data.significant_cells,
                total: data.cells.length,
                years: data.el_nino_years.length,
                from: data.record_years[0] ?? 1990,
                to: data.record_years[1] ?? 2023,
              })}
            </span>
          </li>
        </ul>
      </div>

      <details className="text-xs text-fg-muted">
        <summary className="min-h-11 cursor-pointer py-2 font-medium text-fg sm:min-h-0 sm:py-0">
          {t('methodTitle')}
        </summary>
        <p className="mt-1.5 max-w-prose leading-relaxed">{data.method}</p>
        <p className="mt-1.5">{t('elNinoYears', { years: data.el_nino_years.join(', ') })}</p>
      </details>
    </div>
  )
}
