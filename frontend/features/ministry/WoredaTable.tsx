'use client'

import { useState } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import type { RiskLevel, WoredaRisk } from '@agriminds/api-types'
import { Badge } from '@/components/ui/badge'
import { localeName } from '@/features/ministry/useMinistry'
import { RISK_BADGE_VARIANT } from '@/lib/risk'
import { cn, formatPercent } from '@/lib/utils'

type SortKey = 'name' | 'farmers' | 'farms' | 'hectares' | 'mean_probability'

export function WoredaTable({ rows }: { rows: WoredaRisk[] }) {
  const t = useTranslations('ministry')
  const tr = useTranslations('risk')
  const locale = useLocale()
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'mean_probability', desc: true })

  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border-strong px-4 py-8 text-center text-sm text-fg-muted">
        {t('noWoredas')}
      </p>
    )
  }

  const sorted = [...rows].sort((a, b) => {
    const dir = sort.desc ? -1 : 1
    if (sort.key === 'name') return dir * localeName(a, locale).localeCompare(localeName(b, locale))
    return dir * (a[sort.key] - b[sort.key])
  })

  const toggle = (key: SortKey) =>
    setSort((prev) => ({ key, desc: prev.key === key ? !prev.desc : true }))

  const columns: Array<{ key: SortKey; label: string; numeric: boolean }> = [
    { key: 'name', label: t('woreda'), numeric: false },
    { key: 'farmers', label: t('farmers'), numeric: true },
    { key: 'farms', label: t('plots'), numeric: true },
    { key: 'hectares', label: t('hectares'), numeric: true },
    { key: 'mean_probability', label: t('meanRisk'), numeric: true },
  ]

  return (
    <>
      {/* Phones get a stacked list: a horizontally scrolled table hides the risk column,
          which is the one column that matters most. */}
      <ul className="flex flex-col gap-2 sm:hidden">
        {sorted.map((row) => (
          <li
            key={row.woreda_id}
            className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-raised p-3"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{localeName(row, locale)}</p>
              <p className="text-xs text-fg-subtle">
                {row.farmers} {t('farmers').toLowerCase()} · {row.farms} {t('plots').toLowerCase()} ·{' '}
                {row.hectares.toFixed(1)} {t('hectaresShort')}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="font-display text-base font-bold tabular">
                {formatPercent(row.mean_probability)}
              </span>
              <Badge variant={RISK_BADGE_VARIANT[row.worst_risk_level as RiskLevel]} size="sm">
                {tr(row.worst_risk_level as RiskLevel)}
              </Badge>
            </div>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto sm:block">
      <table className="w-full min-w-[32rem] text-sm">
        <caption className="sr-only">{t('byWoredaTitle')}</caption>
        <thead>
          <tr className="text-xs font-semibold tracking-wide text-fg-muted uppercase">
            {columns.map((col) => {
              const active = sort.key === col.key
              return (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={active ? (sort.desc ? 'descending' : 'ascending') : 'none'}
                  className={cn('pb-2', col.numeric ? 'text-right' : 'text-left')}
                >
                  <button
                    type="button"
                    onClick={() => toggle(col.key)}
                    className={cn(
                      'inline-flex min-h-8 items-center gap-1 rounded px-1 transition-colors hover:text-fg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                      active && 'text-fg',
                    )}
                  >
                    {col.label}
                    {active &&
                      (sort.desc ? (
                        <ArrowDown className="size-3" aria-hidden />
                      ) : (
                        <ArrowUp className="size-3" aria-hidden />
                      ))}
                  </button>
                </th>
              )
            })}
            <th scope="col" className="pb-2 text-right">
              {t('worstLevel')}
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={row.woreda_id} className="border-t border-border">
              <th scope="row" className="py-2.5 text-left font-medium">
                {localeName(row, locale)}
                <span className="block text-xs font-normal text-fg-subtle">{row.zone_name_en}</span>
              </th>
              <td className="py-2.5 text-right tabular">{row.farmers}</td>
              <td className="py-2.5 text-right tabular">{row.farms}</td>
              <td className="py-2.5 text-right tabular">{row.hectares.toFixed(1)}</td>
              <td className="py-2.5 text-right tabular">{formatPercent(row.mean_probability)}</td>
              <td className="py-2.5 text-right">
                <Badge variant={RISK_BADGE_VARIANT[row.worst_risk_level as RiskLevel]} size="sm">
                  {tr(row.worst_risk_level as RiskLevel)}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </>
  )
}
