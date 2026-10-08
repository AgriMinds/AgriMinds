'use client'

import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Droplets,
  HelpCircle,
  ShieldCheck,
  Sparkles,
  Wheat,
  XCircle,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { AdvisoryResponse, Crop } from '@agriminds/api-types'
import { CROPS } from '@agriminds/api-types'
import { Card, CardContent, CardDescription, CardHeader, CardIcon, CardTitle } from '@/components/ui/card'
import { QueryError } from '@/components/ui/query-state'
import { Skeleton } from '@/components/ui/skeleton'
import { RISK_ACCENT_BORDER, RISK_SOFT_CLASS } from '@/lib/risk'
import { cn, formatPercent } from '@/lib/utils'

type Props = {
  crop: Crop
  onCropChange: (c: Crop) => void
  iekAgrees: boolean | null
  onIekChange: (v: boolean | null) => void
  advisory?: AdvisoryResponse
  isLoading: boolean
  isFetching: boolean
  error: unknown
  onRetry: () => void
}

function Toggle({
  active,
  onClick,
  children,
  tone = 'primary',
  className,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  tone?: 'primary' | 'bad' | 'neutral'
  className?: string
}) {
  const activeTone = {
    primary: 'border-primary bg-primary/10 ring-2 ring-primary/30',
    bad: 'border-status-bad bg-status-bad/10 ring-2 ring-status-bad/30',
    neutral: 'border-fg-muted bg-surface-sunken ring-2 ring-fg-muted/20',
  }[tone]
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'min-h-11 rounded-xl border p-2 text-left transition-[background-color,border-color,box-shadow] duration-150 focus-visible:ring-2 focus-visible:ring-ring',
        active
          ? cn(activeTone, 'font-black shadow-xs')
          : 'border-border bg-surface-raised text-fg-muted hover:bg-surface-sunken',
        className,
      )}
    >
      {children}
    </button>
  )
}

function Directive({
  icon,
  title,
  body,
  tone,
}: {
  icon: React.ReactNode
  title: string
  body: string
  tone: string
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-surface-raised/80 p-3 shadow-xs sm:p-3.5">
      <div className="flex items-center gap-1.5 text-xs font-bold">
        <CardIcon className={cn('size-5 [&_svg]:size-3', tone)}>{icon}</CardIcon>
        <span>{title}</span>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-fg-muted">{body}</p>
    </div>
  )
}

export function CropDecisionPanel({
  crop,
  onCropChange,
  iekAgrees,
  onIekChange,
  advisory,
  isLoading,
  isFetching,
  error,
  onRetry,
}: Props) {
  const t = useTranslations('advisory')
  const tr = useTranslations('risk')
  const tp = useTranslations('provenance')

  return (
    <Card>
      <CardHeader>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <CardIcon>
              <Wheat />
            </CardIcon>
            <CardTitle>{t('title')}</CardTitle>
          </div>
          <CardDescription>{t('subtitle')}</CardDescription>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <fieldset>
            <legend className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">
              {t('targetCrop')}
            </legend>
            <div className="mt-1.5 grid grid-cols-3 gap-1.5 sm:gap-2">
              {CROPS.map((c) => (
                <Toggle key={c} active={crop === c} onClick={() => onCropChange(c)}>
                  <div className="truncate text-xs">{t(`crops.${c}.label`)}</div>
                  <div className="mt-0.5 truncate text-[10px] font-normal text-fg-subtle">
                    {t(`crops.${c}.desc`)}
                  </div>
                </Toggle>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-fg-muted">
              <Sparkles className="size-3.5 text-brand-ochre" /> {t('iekTitle')}
            </legend>
            <div className="mt-1.5 grid grid-cols-3 gap-1.5 sm:gap-2">
              <Toggle active={iekAgrees === true} onClick={() => onIekChange(true)} className="text-center">
                <CheckCircle2 className="mx-auto mb-0.5 size-4 text-primary" />
                <div className="truncate text-[11px]">{t('iekAgrees')}</div>
              </Toggle>
              <Toggle
                active={iekAgrees === false}
                onClick={() => onIekChange(false)}
                tone="bad"
                className="text-center"
              >
                <XCircle className="mx-auto mb-0.5 size-4 text-status-bad" />
                <div className="truncate text-[11px]">{t('iekDisagrees')}</div>
              </Toggle>
              <Toggle
                active={iekAgrees === null}
                onClick={() => onIekChange(null)}
                tone="neutral"
                className="text-center"
              >
                <HelpCircle className="mx-auto mb-0.5 size-4 text-fg-muted" />
                <div className="truncate text-[11px]">{t('iekNotSet')}</div>
              </Toggle>
            </div>
          </fieldset>
        </div>

        {error && !advisory ? (
          <QueryError error={error} onRetry={onRetry} isRetrying={isFetching} />
        ) : isLoading && !advisory ? (
          <div
            className="flex flex-col gap-3 rounded-2xl border border-border p-4"
            aria-busy
            aria-label={t('evaluating')}
          >
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-72 max-w-full" />
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          </div>
        ) : advisory ? (
          <div
            aria-busy={isFetching}
            className={cn(
              'rounded-2xl border border-l-6 p-4 shadow-xs transition-opacity sm:p-5',
              RISK_SOFT_CLASS[advisory.risk_level],
              RISK_ACCENT_BORDER[advisory.risk_level],
              isFetching && 'opacity-70',
            )}
          >
            <div className="flex flex-col justify-between gap-3 border-b border-fg/10 pb-3.5 sm:flex-row sm:items-center">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-fg-muted sm:text-[11px]">
                  {t('evalCrop')}: <strong className="capitalize text-fg">{advisory.crop}</strong>
                </span>
                <h3 className="text-lg font-black tracking-tight sm:text-2xl">
                  {t('evalRisk')}: {tr(advisory.risk_level)}
                </h3>
                <p className="mt-0.5 text-xs text-fg-muted">
                  {advisory.target_date} · {advisory.season} · {t('enso')}:{' '}
                  <strong className="text-fg">{advisory.enso_state}</strong>
                </p>
              </div>
              <div className="self-start sm:self-auto sm:text-right">
                <span className="text-[10px] font-semibold text-fg-muted sm:text-[11px]">
                  {t('cropAdjustedRisk')}
                </span>
                <div className="text-2xl font-black leading-none tracking-tight sm:text-3xl">
                  {formatPercent(advisory.adjusted_probability)}
                </div>
                <div className="mt-0.5 text-[10px] text-fg-muted">
                  {t('rawGrid')}: {formatPercent(advisory.raw_probability)}
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
              <Directive
                icon={<Wheat />}
                title={t('strategyTitle')}
                body={advisory.crop_recommendation}
                tone="bg-primary/15 text-primary"
              />
              <Directive
                icon={<Clock />}
                title={t('plantingTitle')}
                body={advisory.planting_window}
                tone="bg-risk-moderate-soft text-fg"
              />
              <Directive
                icon={<Droplets />}
                title={t('waterTitle')}
                body={advisory.water_management}
                tone="bg-enso-cool/15 text-enso-cool"
              />
              <Directive
                icon={<AlertTriangle />}
                title={t('prepTitle')}
                body={advisory.preparedness_action}
                tone="bg-risk-severe-soft text-fg"
              />
            </div>

            <div className="mt-3.5 flex flex-col justify-between gap-2.5 rounded-xl border border-dashed border-border bg-surface-raised/80 p-3 text-xs sm:flex-row sm:items-center">
              <div className="flex items-start gap-2">
                <Sparkles className="mt-0.5 size-4 shrink-0 text-brand-ochre" />
                <p>
                  <span className="font-bold">{t('iekIntegration')}: </span>
                  <span className="italic text-fg-muted">{advisory.iek_assessment}</span>
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-border bg-surface-sunken px-2.5 py-1 text-[11px] font-bold sm:self-auto">
                <ShieldCheck className="size-3.5 text-primary" />
                <span>
                  {t('confidenceRating')}: {advisory.confidence_level}
                </span>
              </div>
            </div>
            <p className="mt-2 font-mono text-[10px] text-fg-subtle">
              {tp('rules', { version: advisory.rules_version })} ·{' '}
              {tp('model', { version: advisory.provenance.model_version })}
            </p>
          </div>
        ) : (
          <p className="p-6 text-center text-xs text-fg-subtle">{t('empty')}</p>
        )}
      </CardContent>
    </Card>
  )
}
