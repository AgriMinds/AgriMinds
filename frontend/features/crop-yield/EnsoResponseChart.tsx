'use client'

import { useTranslations } from 'next-intl'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine, XAxis, YAxis } from 'recharts'
import type { CropYieldCell } from '@agriminds/api-types'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'

/**
 * How much the ENSO anomaly moves each crop-zone prediction, as a signed percentage.
 *
 * A grouped "expected vs neutral" pair would be two bars of visibly identical height, which
 * hides the thing worth seeing. The difference itself is the measure, so it gets a diverging
 * scale around a neutral zero line: warm below neutral, cool above, with the value printed on
 * every bar because the magnitudes are small enough that the axis alone would not carry them.
 *
 * Colours are the theme's own warm/cool poles (`--brand-clay`, `--pdsi-very-wet`), validated in
 * both modes for lightness band, chroma, CVD separation and contrast against the card surface.
 */
const LOSS = { light: '#c67544', dark: '#c67544' }
const GAIN = { light: '#2879b1', dark: '#2479b2' }

type Row = { label: string; delta: number; expected: number; neutral: number }

export function EnsoResponseChart({ cells }: { cells: CropYieldCell[] }) {
  const t = useTranslations('cropYield')
  const ta = useTranslations('advisory')

  const rows: Row[] = cells.map((cell) => ({
    label: `${ta(`crops.${cell.crop}.label`)} · ${cell.zone_local_name}`,
    delta: cell.enso_delta_pct,
    expected: cell.predicted_yield_q_ha,
    neutral: cell.neutral_yield_q_ha,
  }))

  const config: ChartConfig = {
    delta: { label: t('ensoTitle') },
    gain: { label: t('ensoGain'), theme: GAIN },
    loss: { label: t('ensoLoss'), theme: LOSS },
  }

  // A symmetric domain keeps the zero line in the middle, so a 2% move cannot be mistaken for a
  // large one by a bar that happens to reach the edge of the plot.
  const reach = Math.max(2, ...rows.map((r) => Math.abs(r.delta))) * 1.35

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-fg-muted">
        {(
          [
            ['gain', t('ensoGain')],
            ['loss', t('ensoLoss')],
          ] as const
        ).map(([key, label]) => (
          <li key={key} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[2px]" style={{ background: `var(--color-${key})` }} aria-hidden />
            {label}
          </li>
        ))}
      </ul>
      <ChartContainer config={config} className="aspect-auto h-[320px] w-full">
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 44, bottom: 4, left: 4 }}>
          <CartesianGrid horizontal={false} />
          <XAxis
            type="number"
            domain={[-reach, reach]}
            tickFormatter={(v: number) => `${v > 0 ? '+' : ''}${v.toFixed(0)}%`}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={132}
            tickLine={false}
            axisLine={false}
            interval={0}
          />
          <ReferenceLine x={0} stroke="var(--border-strong)" />
          <ChartTooltip
            cursor={{ fill: 'var(--surface-sunken)' }}
            content={
              <ChartTooltipContent
                nameKey="delta"
                formatter={(value) => (
                  <span className="font-mono tabular-nums">
                    {Number(value) > 0 ? '+' : ''}
                    {Number(value).toFixed(2)}%
                  </span>
                )}
              />
            }
          />
          <Bar dataKey="delta" radius={4} barSize={14} isAnimationActive={false}>
            {rows.map((row) => (
              <Cell
                key={row.label}
                fill={row.delta < 0 ? 'var(--color-loss)' : 'var(--color-gain)'}
              />
            ))}
            <LabelList
              dataKey="delta"
              position="right"
              className="fill-fg-muted text-[11px] tabular-nums"
              formatter={(value) => {
                const delta = Number(value)
                return `${delta > 0 ? '+' : ''}${delta.toFixed(1)}%`
              }}
            />
          </Bar>
        </BarChart>
      </ChartContainer>
      <details className="text-xs text-fg-muted">
        <summary className="cursor-pointer font-medium text-fg">{t('ensoTableView')}</summary>
        <table className="mt-2 w-full text-left">
          <thead className="text-fg-subtle">
            <tr>
              <th scope="col" className="py-1 font-medium">
                &nbsp;
              </th>
              <th scope="col" className="py-1 text-right font-medium">
                {t('predicted')}
              </th>
              <th scope="col" className="py-1 text-right font-medium">
                {t('neutral')}
              </th>
              <th scope="col" className="py-1 text-right font-medium">
                Δ
              </th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {rows.map((row) => (
              <tr key={row.label} className="border-t border-border">
                <th scope="row" className="py-1 pr-2 font-normal text-fg">
                  {row.label}
                </th>
                <td className="py-1 text-right font-mono">{row.expected.toFixed(2)}</td>
                <td className="py-1 text-right font-mono">{row.neutral.toFixed(2)}</td>
                <td className="py-1 text-right font-mono">
                  {row.delta > 0 ? '+' : ''}
                  {row.delta.toFixed(2)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}
