'use client'

/**
 * Model Performance Page — /prediction/metrics
 *
 * Section 1  KPI strip          — RMSE · MAE · Accuracy · Precision · Recall · F1 · AUC · BSS (Lead 1)
 * Section 2  Figure 1           — Comparative bar chart: SuperHybrid vs CNN-LSTM, CNN, ANN, LSTM
 * Section 3  Figure 2           — Historical validation: observed vs predicted Sc-PDSI (2011-2025)
 * Section 4  ENSO error charts  — RMSE / MAE trend + histogram by lead
 * Section 5  Drought skill      — AUC + BSS dual-axis
 * Section 6  Confusion matrix   — per-lead TP/FP/TN/FN grid
 * Section 7  Full scorecards    — drought + ENSO detail tables
 */

import React, { useState } from 'react'
import {
  Activity,
  BarChart3,
  BrainCircuit,
  ChevronLeft,
  CircleAlert,
  FlaskConical,
  LineChart,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import {
  Bar,
  BarChart as ReBarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart as ReLineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardHeading,
  CardIcon,
  CardTitle,
} from '@/components/ui/card'
import { QueryError } from '@/components/ui/query-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Stat } from '@/components/ui/stat'
import type { DroughtLeadMetric, EnsoLeadMetric } from '@/lib/api/client'
import { cn } from '@/lib/utils'

import { useModelMetrics } from './useModelMetrics'

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  superhybrid: 'oklch(0.5 0.13 160)',
  cnnlstm:     'oklch(0.43 0.13 250)',
  cnn:         'oklch(0.69 0.19 45)',
  ann:         'oklch(0.8 0.16 82)',
  lstm:        'oklch(0.56 0.22 18)',
  observed:    'oklch(0.35 0.01 0)',
  predicted:   'oklch(0.5 0.13 160)',
  persistence: 'oklch(0.69 0.19 45)',
  ridge:       'oklch(0.8 0.16 82)',
  threshold:   'oklch(0.56 0.22 18)',
  auc:         'oklch(0.43 0.13 250)',
  grid:        'oklch(0.9 0.012 120)',
  axis:        'oklch(0.62 0.015 170)',
} as const

const MODEL_COLOR: Record<string, string> = {
  'SuperHybrid (CNN-LSTM-Fourier)': C.superhybrid,
  'CNN-LSTM':   C.cnnlstm,
  'CNN':        C.cnn,
  'ANN':        C.ann,
  'LSTM':       C.lstm,
  'Persistence': C.persistence,
  'Ridge':      C.ridge,
}

// ── Shared tooltip ────────────────────────────────────────────────────────────
function ChartTooltip({
  active, payload, label,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string; fill?: string }>
  label?: string | number
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-border bg-surface-raised px-3 py-2 shadow-lg text-xs min-w-[170px]">
      <p className="font-semibold text-fg mb-1.5">{typeof label === 'number' ? `Lead ${label}m` : label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 py-0.5">
          <span className="size-2 rounded-full shrink-0" style={{ background: p.color ?? p.fill }} />
          <span className="text-fg-muted flex-1 truncate">{p.name}</span>
          <span className="font-mono font-medium tabular-nums text-fg">
            {typeof p.value === 'number' ? p.value.toFixed(3) : p.value}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── KPI tile ──────────────────────────────────────────────────────────────────
function KpiTile({
  icon, label, value, detail, good,
}: {
  icon: React.ReactNode
  label: string
  value: string
  detail: string
  good: boolean | null
}) {
  const tone =
    good === null ? '' : good
      ? 'bg-status-ok/12 text-status-ok'
      : 'bg-status-warn/18 text-status-warn'
  return <Stat icon={icon} label={label} value={value} detail={detail} tone={tone} />
}

// ── Figure 1: comparative bar chart ──────────────────────────────────────────
type CompMetric = 'AUC' | 'Accuracy' | 'F1' | 'RMSE' | 'MAE'

function ModelComparisonChart({
  rows,
}: {
  rows: Array<{ model: string; lead: number; RMSE: number; MAE: number; AUC: number; Accuracy: number; F1: number }>
}) {
  const [metric, setMetric] = useState<CompMetric>('AUC')
  const metrics: CompMetric[] = ['AUC', 'Accuracy', 'F1', 'RMSE', 'MAE']
  const lowerIsBetter = metric === 'RMSE' || metric === 'MAE'

  // Pivot: one entry per lead, one key per model
  const leads = [...new Set(rows.map((r) => r.lead))].sort((a, b) => a - b)
  const models = [...new Set(rows.map((r) => r.model))]
  const data = leads.map((lead) => {
    const entry: Record<string, number | string> = { lead }
    for (const m of models) {
      const row = rows.find((r) => r.lead === lead && r.model === m)
      if (row) entry[m] = row[metric]
    }
    return entry
  })

  return (
    <div className="flex flex-col gap-3">
      {/* metric selector */}
      <div className="flex flex-wrap gap-1.5">
        {metrics.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMetric(m)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              metric === m
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-fg-muted hover:border-border-strong hover:text-fg',
            )}
          >
            {m}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-fg-subtle self-center">
          {lowerIsBetter ? '↓ lower is better' : '↑ higher is better'}
        </span>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <ReBarChart data={data} margin={{ top: 6, right: 12, bottom: 20, left: 2 }} barCategoryGap="18%" barGap={2}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
          <XAxis
            dataKey="lead"
            tick={{ fill: C.axis, fontSize: 11 }}
            tickFormatter={(v) => `L${v}`}
            label={{ value: 'Lead (months)', position: 'insideBottom', offset: -8, fill: C.axis, fontSize: 11 }}
          />
          <YAxis
            tick={{ fill: C.axis, fontSize: 11 }}
            tickFormatter={(v: number) => v.toFixed(2)}
            width={50}
          />
          <Tooltip content={<ChartTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
            formatter={(v) => <span style={{ color: C.axis }}>{v}</span>}
          />
          {models.map((m) => (
            <Bar
              key={m}
              dataKey={m}
              fill={MODEL_COLOR[m] ?? '#888'}
              radius={[3, 3, 0, 0]}
              maxBarSize={22}
              opacity={m === 'SuperHybrid (CNN-LSTM-Fourier)' ? 1 : 0.6}
            />
          ))}
        </ReBarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Figure 2: historical validation ──────────────────────────────────────────
function HistoricalValidationChart({
  rows,
}: {
  rows: Array<{ lead: number; date: string; observed: number; predicted: number; PearsonR: number; RMSE: number; MAE: number }>
}) {
  const leads = [...new Set(rows.map((r) => r.lead))].sort((a, b) => a - b)
  const [lead, setLead] = useState(leads[0] ?? 1)

  const filtered = rows
    .filter((r) => r.lead === lead)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => ({ ...r, month: r.date.slice(0, 7) }))

  const summary = filtered[0]

  return (
    <div className="flex flex-col gap-3">
      {/* lead selector */}
      <div className="flex flex-wrap gap-1.5 items-center">
        <span className="text-xs text-fg-subtle">Lead:</span>
        {leads.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLead(l)}
            className={cn(
              'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
              lead === l
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-fg-muted hover:border-border-strong hover:text-fg',
            )}
          >
            {l}m
          </button>
        ))}
        {summary && (
          <span className="ml-auto font-mono text-[11px] text-fg-subtle">
            R = {summary.PearsonR.toFixed(3)} · RMSE = {summary.RMSE.toFixed(3)} · MAE = {summary.MAE.toFixed(3)}
          </span>
        )}
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <ReLineChart data={filtered} margin={{ top: 6, right: 12, bottom: 20, left: 2 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
          <XAxis
            dataKey="month"
            tick={{ fill: C.axis, fontSize: 10 }}
            interval={Math.floor(filtered.length / 8)}
            label={{ value: 'Date', position: 'insideBottom', offset: -8, fill: C.axis, fontSize: 11 }}
          />
          <YAxis
            tick={{ fill: C.axis, fontSize: 11 }}
            tickFormatter={(v: number) => v.toFixed(1)}
            label={{ value: 'Sc-PDSI', angle: -90, position: 'insideLeft', offset: 14, fill: C.axis, fontSize: 11 }}
            width={50}
          />
          <ReferenceLine y={0} stroke={C.grid} strokeWidth={1} />
          <ReferenceLine y={-1} stroke={C.threshold} strokeDasharray="4 3" strokeWidth={1}
            label={{ value: 'Drought', fill: C.threshold, fontSize: 10, position: 'insideTopLeft' }} />
          <Tooltip content={<ChartTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
            formatter={(v) => <span style={{ color: C.axis }}>{v}</span>}
          />
          <Line type="monotone" dataKey="observed" name="Observed" stroke={C.observed} strokeWidth={2}
            dot={false} activeDot={{ r: 3 }} />
          <Line type="monotone" dataKey="predicted" name="Predicted" stroke={C.predicted} strokeWidth={2}
            strokeDasharray="5 3" dot={false} activeDot={{ r: 3 }} />
        </ReLineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── ENSO helpers ──────────────────────────────────────────────────────────────
function pivotEnso(rows: EnsoLeadMetric[], metric: 'RMSE' | 'MAE' | 'corr') {
  const map = new Map<number, Record<string, number>>()
  for (const r of rows) {
    if (!map.has(r.lead)) map.set(r.lead, { lead: r.lead })
    map.get(r.lead)![r.model] = r[metric]
  }
  return Array.from(map.values()).sort((a, b) => (a.lead as number) - (b.lead as number))
}
function distinctModels(rows: EnsoLeadMetric[]) {
  return [...new Set(rows.map((r) => r.model))]
}

function EnsoErrorChart({ enso, metric, yLabel }: { enso: EnsoLeadMetric[]; metric: 'RMSE' | 'MAE'; yLabel: string }) {
  const data = pivotEnso(enso, metric)
  const models = distinctModels(enso)
  return (
    <ResponsiveContainer width="100%" height={240}>
      <ReLineChart data={data} margin={{ top: 6, right: 12, bottom: 20, left: 2 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
        <XAxis dataKey="lead" tick={{ fill: C.axis, fontSize: 11 }} tickFormatter={(v) => `L${v}`}
          label={{ value: 'Lead (months)', position: 'insideBottom', offset: -8, fill: C.axis, fontSize: 11 }} />
        <YAxis tick={{ fill: C.axis, fontSize: 11 }} tickFormatter={(v: number) => v.toFixed(2)}
          label={{ value: yLabel, angle: -90, position: 'insideLeft', offset: 14, fill: C.axis, fontSize: 11 }} width={50} />
        <Tooltip content={<ChartTooltip />} />
        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} formatter={(v) => <span style={{ color: C.axis }}>{v}</span>} />
        {models.map((m) => (
          <Line key={m} type="monotone" dataKey={m} stroke={MODEL_COLOR[m] ?? '#888'}
            strokeWidth={m === 'CNN-LSTM' ? 2.5 : 1.5}
            dot={m === 'CNN-LSTM' ? { r: 3, fill: MODEL_COLOR[m] } : false}
            activeDot={{ r: 4 }} />
        ))}
      </ReLineChart>
    </ResponsiveContainer>
  )
}

function AucBssChart({ drought }: { drought: DroughtLeadMetric[] }) {
  const data = drought.map((d) => ({
    lead: d.lead,
    'AUC (CNN-LSTM)': d.AUC,
    'AUC (Persist.)': d.AUC_persistence,
    BSS: d.BSS_vs_climatology,
  }))
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ReLineChart data={data} margin={{ top: 6, right: 54, bottom: 20, left: 2 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
        <XAxis dataKey="lead" tick={{ fill: C.axis, fontSize: 11 }} tickFormatter={(v) => `L${v}`}
          label={{ value: 'Lead (months)', position: 'insideBottom', offset: -8, fill: C.axis, fontSize: 11 }} />
        <YAxis yAxisId="auc" domain={[0.35, 0.8]} tick={{ fill: C.axis, fontSize: 11 }}
          tickFormatter={(v: number) => v.toFixed(2)}
          label={{ value: 'AUC', angle: -90, position: 'insideLeft', offset: 14, fill: C.axis, fontSize: 11 }} width={50} />
        <YAxis yAxisId="bss" orientation="right" domain={[-0.06, 0.08]} tick={{ fill: C.axis, fontSize: 11 }}
          tickFormatter={(v: number) => v.toFixed(3)}
          label={{ value: 'BSS', angle: 90, position: 'insideRight', offset: 12, fill: C.axis, fontSize: 11 }} width={50} />
        <ReferenceLine yAxisId="bss" y={0} stroke={C.threshold} strokeDasharray="5 3" strokeWidth={1.5}
          label={{ value: 'BSS=0', fill: C.threshold, fontSize: 10, position: 'insideTopLeft' }} />
        <Tooltip content={<ChartTooltip />} />
        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} formatter={(v) => <span style={{ color: C.axis }}>{v}</span>} />
        <Line yAxisId="auc" type="monotone" dataKey="AUC (CNN-LSTM)" stroke={C.auc} strokeWidth={2.5} dot={{ r: 3, fill: C.auc }} activeDot={{ r: 4 }} />
        <Line yAxisId="auc" type="monotone" dataKey="AUC (Persist.)" stroke={C.persistence} strokeWidth={1.5} strokeDasharray="5 3" dot={false} activeDot={{ r: 3 }} />
        <Line yAxisId="bss" type="monotone" dataKey="BSS" stroke={C.superhybrid} strokeWidth={2} dot={{ r: 3, fill: C.superhybrid }} activeDot={{ r: 4 }} />
      </ReLineChart>
    </ResponsiveContainer>
  )
}

function ConfusionMatrixGrid({ drought }: { drought: DroughtLeadMetric[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {drought.map((d) => {
        const total = d.TP + d.FP + d.TN + d.FN
        const pct = (n: number) => total > 0 ? `${Math.round((n / total) * 100)}%` : '—'
        return (
          <div key={d.lead} className={cn(
            'rounded-xl border p-3 text-xs',
            d.skilful ? 'border-status-ok/40 bg-status-ok/[0.04]' : 'border-border bg-surface-sunken/40',
          )}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-fg">Lead {d.lead}m</span>
              {d.skilful && <Badge variant="ok" size="sm">Skilful</Badge>}
            </div>
            <div className="grid grid-cols-2 gap-1 text-center">
              <div className="rounded bg-status-ok/15 p-1.5">
                <div className="font-mono font-bold text-status-ok">{d.TP}</div>
                <div className="text-[10px] text-fg-subtle">TP {pct(d.TP)}</div>
              </div>
              <div className="rounded bg-status-bad/15 p-1.5">
                <div className="font-mono font-bold text-status-bad">{d.FP}</div>
                <div className="text-[10px] text-fg-subtle">FP {pct(d.FP)}</div>
              </div>
              <div className="rounded bg-status-bad/10 p-1.5">
                <div className="font-mono font-bold text-status-warn">{d.FN}</div>
                <div className="text-[10px] text-fg-subtle">FN {pct(d.FN)}</div>
              </div>
              <div className="rounded bg-surface-sunken p-1.5">
                <div className="font-mono font-bold text-fg-muted">{d.TN}</div>
                <div className="text-[10px] text-fg-subtle">TN {pct(d.TN)}</div>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-2 text-[10px] text-fg-subtle">
              <span>Acc {d.Accuracy.toFixed(2)}</span>
              <span>F1 {d.F1.toFixed(2)}</span>
              <span>Prec {d.Precision.toFixed(2)}</span>
              <span>Rec {d.Recall.toFixed(2)}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function DroughtMetricsTable({ drought }: { drought: DroughtLeadMetric[] }) {
  const cols = ['Lead','AUC','AUC Pers.','BSS','Accuracy','Precision','Recall','F1','PearsonR','Skilful']
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-xs border-collapse min-w-[700px]">
        <thead>
          <tr className="border-b border-border">
            {cols.map((h) => <th key={h} className="px-3 py-2 text-left font-semibold text-fg-subtle whitespace-nowrap">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {drought.map((row) => (
            <tr key={row.lead} className={cn('border-b border-border/50 transition-colors hover:bg-surface-sunken/50', row.skilful && 'bg-status-ok/[0.04]')}>
              <td className="px-3 py-2 font-mono font-bold">{row.lead}</td>
              <td className="px-3 py-2 font-mono">{row.AUC.toFixed(3)}</td>
              <td className="px-3 py-2 font-mono text-fg-muted">{row.AUC_persistence.toFixed(3)}</td>
              <td className={cn('px-3 py-2 font-mono font-semibold', row.BSS_vs_climatology >= 0 ? 'text-status-ok' : 'text-status-bad')}>
                {row.BSS_vs_climatology > 0 ? '+' : ''}{row.BSS_vs_climatology.toFixed(3)}
              </td>
              <td className="px-3 py-2 font-mono">{row.Accuracy.toFixed(3)}</td>
              <td className="px-3 py-2 font-mono">{row.Precision.toFixed(3)}</td>
              <td className="px-3 py-2 font-mono">{row.Recall.toFixed(3)}</td>
              <td className="px-3 py-2 font-mono font-semibold">{row.F1.toFixed(3)}</td>
              <td className={cn('px-3 py-2 font-mono', row.PearsonR >= 0.5 ? 'text-status-ok' : '')}>{row.PearsonR.toFixed(3)}</td>
              <td className="px-3 py-2">
                {row.skilful ? <Badge variant="ok" size="sm">Yes</Badge> : <Badge variant="outline" size="sm">No</Badge>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function EnsoMetricsTable({ enso }: { enso: EnsoLeadMetric[] }) {
  const models = distinctModels(enso)
  const leads = [...new Set(enso.map((r) => r.lead))].sort((a, b) => a - b)
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-xs border-collapse min-w-[600px]">
        <thead>
          <tr className="border-b border-border">
            <th className="px-3 py-2 text-left font-semibold text-fg-subtle">Lead</th>
            {models.flatMap((m) => [
              <th key={`${m}-r`} className="px-3 py-2 text-left font-semibold text-fg-subtle whitespace-nowrap">{m} RMSE</th>,
              <th key={`${m}-m`} className="px-3 py-2 text-left font-semibold text-fg-subtle whitespace-nowrap">{m} MAE</th>,
              <th key={`${m}-c`} className="px-3 py-2 text-left font-semibold text-fg-subtle whitespace-nowrap">{m} r</th>,
            ])}
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => {
            const byModel = new Map(enso.filter((r) => r.lead === lead).map((r) => [r.model, r]))
            return (
              <tr key={lead} className="border-b border-border/50 hover:bg-surface-sunken/50 transition-colors">
                <td className="px-3 py-2 font-mono font-bold">{lead}</td>
                {models.flatMap((m) => {
                  const r = byModel.get(m)
                  const isCnn = m === 'CNN-LSTM'
                  return [
                    <td key={`${m}-r`} className={cn('px-3 py-2 font-mono', isCnn ? 'font-semibold' : 'text-fg-muted')}>{r ? r.RMSE.toFixed(3) : '—'}</td>,
                    <td key={`${m}-m`} className={cn('px-3 py-2 font-mono', isCnn ? 'font-semibold' : 'text-fg-muted')}>{r ? r.MAE.toFixed(3) : '—'}</td>,
                    <td key={`${m}-c`} className={cn('px-3 py-2 font-mono', r && r.corr >= 0.7 ? 'text-status-ok font-semibold' : r && r.corr < 0.2 ? 'text-fg-subtle' : '')}>{r ? r.corr.toFixed(3) : '—'}</td>,
                  ]
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export function ModelMetricsPage() {
  const t = useTranslations('prediction')
  const { data, error, isPending, isFetching, refetch } = useModelMetrics()

  const lead1d = data?.drought.find((d) => d.lead === 1)
  const lead1e = data?.enso.find((e) => e.lead === 1 && e.model === 'CNN-LSTM')
  const isSynthetic = data?.data_source === 'synthetic'
  const hasEnso = (data?.enso.length ?? 0) > 0
  const hasComparison = (data?.model_comparison?.length ?? 0) > 0
  const hasValidation = (data?.historical_validation?.length ?? 0) > 0

  return (
    <>
      <div className="bg-contour border-b border-border">
        <div className="mx-auto flex max-w-[1100px] flex-col gap-2 px-4 pt-8 pb-7 sm:px-6 lg:px-8">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-fg-subtle">
            <Link href="/prediction" className="flex items-center gap-1 hover:text-fg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">
              <ChevronLeft className="size-3.5" aria-hidden /> Forecast Horizon
            </Link>
            <span aria-hidden>/</span>
            <span className="text-fg-muted" aria-current="page">Model Performance</span>
          </nav>
          <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-primary uppercase mt-1">
            <BarChart3 className="size-3.5" aria-hidden /> {t('metricsEyebrow')}
          </p>
          <h1 className="font-display text-display font-bold">{t('metricsTitle')}</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-fg-muted sm:text-base">{t('metricsIntro')}</p>
          {data && (
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {isSynthetic
                ? <Badge variant="warn" className="gap-1.5"><FlaskConical className="size-3" aria-hidden />Synthetic data</Badge>
                : <Badge variant="ok">Observed record</Badge>}
              <Badge variant="outline">{data.model_version}</Badge>
              {data.trained_at && (
                <span className="text-xs text-fg-subtle font-mono">
                  Trained {new Date(data.trained_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">

        {isSynthetic && (
          <div role="status" aria-live="polite" className="flex items-start gap-3 rounded-xl border border-status-warn/40 bg-status-warn/[0.06] p-4">
            <CircleAlert className="size-5 shrink-0 text-status-warn mt-0.5" aria-hidden />
            <div className="text-sm">
              <p className="font-semibold text-fg">Synthetic training data</p>
              <p className="mt-0.5 text-fg-muted leading-relaxed">
                Run <code className="rounded bg-surface-sunken px-1 py-0.5 font-mono text-xs">make train-real</code> to ingest the real inputs and retrain.
              </p>
            </div>
          </div>
        )}

        {isPending && (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 xl:grid-cols-8">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
            </div>
            <Skeleton className="h-80 rounded-2xl" />
            <Skeleton className="h-80 rounded-2xl" />
          </>
        )}

        {error && <QueryError error={error} onRetry={() => void refetch()} isRetrying={isFetching} />}

        {data && (
          <>
            {/* 1. KPI strip */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 xl:grid-cols-8">
              <KpiTile icon={<TrendingDown />} label="RMSE · L1" value={lead1e ? lead1e.RMSE.toFixed(3) : '—'} detail="CNN-LSTM Niño 3.4" good={lead1e ? lead1e.RMSE < 0.75 : null} />
              <KpiTile icon={<Activity />} label="MAE · L1" value={lead1e ? lead1e.MAE.toFixed(3) : '—'} detail="CNN-LSTM Niño 3.4" good={lead1e ? lead1e.MAE < 0.6 : null} />
              <KpiTile icon={<LineChart />} label="Pearson R · L1" value={lead1e ? lead1e.corr.toFixed(3) : '—'} detail="CNN-LSTM vs observed" good={lead1e ? lead1e.corr >= 0.7 : null} />
              <KpiTile icon={<BarChart3 />} label="AUC · L1" value={lead1d ? lead1d.AUC.toFixed(3) : '—'} detail="Drought classification" good={lead1d ? lead1d.AUC >= 0.7 : null} />
              <KpiTile icon={<BrainCircuit />} label="BSS · L1" value={lead1d ? (lead1d.BSS_vs_climatology > 0 ? '+' : '') + lead1d.BSS_vs_climatology.toFixed(3) : '—'} detail="vs climatology" good={lead1d ? lead1d.BSS_vs_climatology > 0 : null} />
              <KpiTile icon={<Target />} label="Accuracy · L1" value={lead1d ? lead1d.Accuracy.toFixed(3) : '—'} detail="Drought classification" good={lead1d ? lead1d.Accuracy >= 0.7 : null} />
              <KpiTile icon={<TrendingUp />} label="F1 · L1" value={lead1d ? lead1d.F1.toFixed(3) : '—'} detail="Precision × Recall" good={lead1d ? lead1d.F1 >= 0.5 : null} />
              <KpiTile icon={<Activity />} label="Precision · L1" value={lead1d ? lead1d.Precision.toFixed(3) : '—'} detail="TP / (TP+FP)" good={lead1d ? lead1d.Precision >= 0.5 : null} />
            </div>

            {/* 2. Figure 1: model comparison */}
            {hasComparison && (
              <Card>
                <CardHeader>
                  <CardHeading>
                    <CardIcon><BarChart3 /></CardIcon>
                    <div className="min-w-0">
                      <CardTitle>Figure 1 — Comparative Model Evaluation</CardTitle>
                      <CardDescription>SuperHybrid (CNN-LSTM-Fourier) vs CNN-LSTM, CNN, ANN, LSTM across all leads. Select a metric.</CardDescription>
                    </div>
                  </CardHeading>
                </CardHeader>
                <CardContent><ModelComparisonChart rows={data.model_comparison} /></CardContent>
                <CardFooter>
                  {['SuperHybrid (CNN-LSTM-Fourier)','CNN-LSTM','CNN','ANN','LSTM'].map((m) => (
                    <div key={m} className="flex items-center gap-2">
                      <span className="size-2.5 rounded-sm shrink-0" style={{ background: MODEL_COLOR[m] }} aria-hidden />
                      <span>{m}</span>
                    </div>
                  ))}
                </CardFooter>
              </Card>
            )}

            {/* 3. Figure 2: historical validation */}
            {hasValidation && (
              <Card>
                <CardHeader>
                  <CardHeading>
                    <CardIcon><LineChart /></CardIcon>
                    <div className="min-w-0">
                      <CardTitle>Figure 2 — Historical Validation (2011–2025)</CardTitle>
                      <CardDescription>Observed vs predicted Sc-PDSI. Trained 1990–2010, evaluated 2011–2025. Pearson R, RMSE and MAE shown per lead.</CardDescription>
                    </div>
                  </CardHeading>
                </CardHeader>
                <CardContent><HistoricalValidationChart rows={data.historical_validation} /></CardContent>
                <CardFooter>
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full shrink-0" style={{ background: C.observed }} aria-hidden />
                    <span>Observed Sc-PDSI</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: C.predicted }} aria-hidden />
                    <span>Predicted (SuperHybrid)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: C.threshold }} aria-hidden />
                    <span>Drought threshold (−1)</span>
                  </div>
                </CardFooter>
              </Card>
            )}

            {/* 4. ENSO error charts */}
            {hasEnso && (
              <Card>
                <CardHeader>
                  <CardHeading>
                    <CardIcon><TrendingDown /></CardIcon>
                    <div className="min-w-0">
                      <CardTitle>ENSO Forecast Error by Lead</CardTitle>
                      <CardDescription>RMSE and MAE of Niño 3.4 forecast (°C). CNN-LSTM vs Persistence and Ridge baselines.</CardDescription>
                    </div>
                  </CardHeading>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold text-fg-subtle mb-2 pl-1">Root Mean Square Error (°C)</p>
                      <EnsoErrorChart enso={data.enso} metric="RMSE" yLabel="RMSE (°C)" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-fg-subtle mb-2 pl-1">Mean Absolute Error (°C)</p>
                      <EnsoErrorChart enso={data.enso} metric="MAE" yLabel="MAE (°C)" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 5. Drought AUC + BSS */}
            <Card>
              <CardHeader>
                <CardHeading>
                  <CardIcon><BarChart3 /></CardIcon>
                  <div className="min-w-0">
                    <CardTitle>Drought Forecast Skill by Lead</CardTitle>
                    <CardDescription>AUC (left axis) and Brier Skill Score vs climatology (right axis). Positive BSS = beats the long-run average.</CardDescription>
                  </div>
                </CardHeading>
              </CardHeader>
              <CardContent><AucBssChart drought={data.drought} /></CardContent>
            </Card>

            {/* 6. Confusion matrix */}
            <Card>
              <CardHeader>
                <CardHeading>
                  <CardIcon><Target /></CardIcon>
                  <div className="min-w-0">
                    <CardTitle>Confusion Matrix — Per Lead</CardTitle>
                    <CardDescription>TP / FP / FN / TN counts with Accuracy, F1, Precision and Recall for each lead month.</CardDescription>
                  </div>
                </CardHeading>
              </CardHeader>
              <CardContent><ConfusionMatrixGrid drought={data.drought} /></CardContent>
            </Card>

            {/* 7. Full scorecards */}
            <Card>
              <CardHeader>
                <CardHeading>
                  <div className="min-w-0">
                    <CardTitle>Drought Metrics — Full Scorecard</CardTitle>
                    <CardDescription>All classification metrics per lead. Skilful rows (BSS &gt; 0) highlighted.</CardDescription>
                  </div>
                </CardHeading>
              </CardHeader>
              <CardContent><DroughtMetricsTable drought={data.drought} /></CardContent>
            </Card>

            {hasEnso && (
              <Card>
                <CardHeader>
                  <CardHeading>
                    <div className="min-w-0">
                      <CardTitle>ENSO Regression Metrics — Full Scorecard</CardTitle>
                      <CardDescription>RMSE, MAE, and Pearson r for every model at every lead. r ≥ 0.70 highlighted green.</CardDescription>
                    </div>
                  </CardHeading>
                </CardHeader>
                <CardContent><EnsoMetricsTable enso={data.enso} /></CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </>
  )
}
