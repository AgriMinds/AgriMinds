'use client'

import { AlertTriangle, CheckCircle2, Clock, Droplets, HelpCircle, ShieldCheck, Sparkles, Sprout, Wheat, XCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { AdvisoryResponse, Crop } from '@agriminds/api-types'
import { CROPS } from '@agriminds/api-types'
import { Badge } from '@/components/ui/badge'
import { Card, CardActions, CardContent, CardDescription, CardFooter, CardHeader, CardHeading, CardIcon, CardTitle } from '@/components/ui/card'
import { QueryError } from '@/components/ui/query-state'
import { SegmentedControl } from '@/components/ui/segmented'
import { Skeleton } from '@/components/ui/skeleton'
import { RISK_ACCENT_BORDER, RISK_SOFT_CLASS, RISK_TEXT_CLASS } from '@/lib/risk'
import { cn, formatPercent } from '@/lib/utils'

type Props = {
  crop: Crop
  onCropChange: (c: Crop) => void
  iekAgrees: boolean | null
  onIekChange: (v: boolean | null) => void
  cell: { row: number; col: number }
  advisory?: AdvisoryResponse
  isLoading: boolean
  isFetching: boolean
  error: unknown
  onRetry: () => void
}

type IekValue = 'agrees' | 'disagrees' | 'unset'
const toIek = (v: boolean | null): IekValue => (v === true ? 'agrees' : v === false ? 'disagrees' : 'unset')
const fromIek = (v: IekValue): boolean | null => (v === 'agrees' ? true : v === 'disagrees' ? false : null)

function Directive({ icon, title, body, tone }: { icon: React.ReactNode; title: string; body: string; tone: string }) {
  return (
    <div className="flex gap-3 rounded-xl border border-border/70 bg-surface-raised p-3.5">
      <CardIcon className={cn('size-8 rounded-lg [&_svg]:size-4', tone)}>{icon}</CardIcon>
      <div className="min-w-0">
        <h4 className="text-sm font-semibold">{title}</h4>
        <p className="mt-1 text-xs leading-relaxed text-fg-muted">{body}</p>
      </div>
    </div>
  )
}

export function CropDecisionPanel({ crop, onCropChange, iekAgrees, onIekChange, cell, advisory, isLoading, isFetching, error, onRetry }: Props) {
  const t = useTranslations('advisory')
  const tr = useTranslations('risk')
  const tp = useTranslations('provenance')

  return (
    <Card className="h-full">
      <CardHeader>
        <CardHeading>
          <CardIcon>
            <Sprout />
          </CardIcon>
          <div className="min-w-0">
            <CardTitle>{t('title')}</CardTitle>
            <CardDescription>{t('subtitle')}</CardDescription>
          </div>
        </CardHeading>
        <CardActions>
          <Badge variant="outline" className="font-mono">
            {t('forCell', { row: cell.row, col: cell.col })}
          </Badge>
        </CardActions>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
          <fieldset className="min-w-0">
            <legend className="mb-2 text-[11px] font-semibold tracking-wider text-fg-muted uppercase">{t('targetCrop')}</legend>
            <SegmentedControl
              aria-label={t('targetCrop')}
              variant="tile"
              value={crop}
              onChange={onCropChange}
              options={CROPS.map((c) => ({ value: c, label: t(`crops.${c}.label`), hint: t(`crops.${c}.desc`) }))}
            />
          </fieldset>
          <fieldset className="min-w-0">
            <legend className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-fg-muted uppercase">
              <Sparkles className="size-3.5 text-brand-ochre" aria-hidden /> {t('iekTitle')}
            </legend>
            <SegmentedControl<IekValue>
              aria-label={t('iekTitle')}
              variant="tile"
              value={toIek(iekAgrees)}
              onChange={(v) => onIekChange(fromIek(v))}
              options={[
                { value: 'agrees', label: t('iekAgrees'), hint: t('iekAgreesHint'), icon: <CheckCircle2 className="text-primary" />, tone: 'primary' },
                { value: 'disagrees', label: t('iekDisagrees'), hint: t('iekDisagreesHint'), icon: <XCircle className="text-status-bad" />, tone: 'bad' },
                { value: 'unset', label: t('iekNotSet'), hint: t('iekNotSetHint'), icon: <HelpCircle className="text-fg-subtle" />, tone: 'neutral' },
              ]}
            />
          </fieldset>
        </div>

        {error && !advisory ? (
          <QueryError error={error} onRetry={onRetry} isRetrying={isFetching} />
        ) : isLoading && !advisory ? (
          <div className="flex flex-col gap-4 rounded-2xl border border-border p-5" aria-busy aria-label={t('evaluating')}>
            <Skeleton className="h-9 w-56" />
            <Skeleton className="h-4 w-80 max-w-full" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          </div>
        ) : advisory ? (
          <div
            aria-busy={isFetching}
            className={cn(
              'flex flex-col gap-5 rounded-2xl border border-l-4 p-4 transition-opacity sm:p-5',
              RISK_SOFT_CLASS[advisory.risk_level],
              RISK_ACCENT_BORDER[advisory.risk_level],
              isFetching && 'opacity-60',
            )}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold tracking-wider text-fg-muted uppercase">
                  {t('evalRisk')} · <span className="capitalize">{advisory.crop}</span>
                </p>
                <h3 className={cn('mt-1 font-display text-display-sm font-bold', RISK_TEXT_CLASS[advisory.risk_level])}>
                  {tr(advisory.risk_level)}
                </h3>
                <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-muted">
                  <span>{advisory.target_date}</span>
                  <span className="text-border-strong">·</span>
                  <span>{advisory.season}</span>
                  <span className="text-border-strong">·</span>
                  <span>
                    {t('enso')}: <strong className="font-semibold text-fg">{advisory.enso_state}</strong>
                  </span>
                </p>
              </div>
              <div className="flex items-baseline gap-4 sm:flex-col sm:items-end sm:gap-0">
                <div className="font-display text-stat font-bold tabular">{formatPercent(advisory.adjusted_probability)}</div>
                <div className="text-[11px] text-fg-muted">
                  {t('cropAdjustedRisk')} · {t('rawGrid')} {formatPercent(advisory.raw_probability)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Directive icon={<Wheat />} title={t('strategyTitle')} body={advisory.crop_recommendation} tone="bg-primary/12 text-primary" />
              <Directive icon={<Clock />} title={t('plantingTitle')} body={advisory.planting_window} tone="bg-brand-ochre/20 text-brand-clay" />
              <Directive icon={<Droplets />} title={t('waterTitle')} body={advisory.water_management} tone="bg-enso-cool/12 text-enso-cool" />
              <Directive icon={<AlertTriangle />} title={t('prepTitle')} body={advisory.preparedness_action} tone="bg-risk-severe/12 text-risk-severe" />
            </div>

            <div className="flex flex-col gap-3 rounded-xl border border-dashed border-border-strong bg-surface-raised/70 p-3.5 text-xs sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-start gap-2">
                <Sparkles className="mt-0.5 size-4 shrink-0 text-brand-ochre" aria-hidden />
                <span>
                  <span className="font-semibold">{t('iekIntegration')}: </span>
                  <span className="text-fg-muted">{advisory.iek_assessment}</span>
                </span>
              </p>
              <Badge variant="outline" size="lg" className="shrink-0 self-start sm:self-auto">
                <ShieldCheck className="text-primary" /> {advisory.confidence_level}
              </Badge>
            </div>
          </div>
        ) : (
          <p className="p-6 text-center text-sm text-fg-subtle">{t('empty')}</p>
        )}
      </CardContent>

      {advisory && (
        <CardFooter className="font-mono text-[10px] text-fg-subtle">
          <span>{tp('rules', { version: advisory.rules_version })}</span>
          <span>{tp('model', { version: advisory.provenance.model_version })}</span>
        </CardFooter>
      )}
    </Card>
  )
}
