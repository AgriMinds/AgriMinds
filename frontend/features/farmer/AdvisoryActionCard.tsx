'use client'

import { AlertTriangle, Check, CircleAlert, Clock, Droplets, OctagonAlert, ShieldCheck, Sparkles, Wheat } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { AdvisoryResponse, PdsiCategory, RiskLevel } from '@agriminds/api-types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CardIcon } from '@/components/ui/card'
import { PDSI_DOT_CLASS, PDSI_ICON, ensoKey, pdsiKey } from '@/lib/classification'
import { RISK_ACCENT_BORDER, RISK_SOFT_CLASS, RISK_TEXT_CLASS } from '@/lib/risk'
import { cn, formatPercent } from '@/lib/utils'

/** Risk is never carried by colour alone: every level also has its own icon and its own words. */
const RISK_ICON: Record<RiskLevel, typeof ShieldCheck> = {
  Low: ShieldCheck,
  Moderate: CircleAlert,
  High: AlertTriangle,
  Severe: OctagonAlert,
}

type Props = {
  advisory: AdvisoryResponse
  plotName?: string
  /** Advisory record id; the acknowledge control appears only when the API supplies one. */
  advisoryId?: string | null
  acknowledged?: boolean
  onAcknowledge?: () => void
  acknowledging?: boolean
  isStale?: boolean
  /** Measured dryness of this plot's cell today. A different quantity from the forecast. */
  ground?: PdsiCategory | null
}

function Directive({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex gap-3 rounded-xl border border-border/70 bg-surface-raised p-3.5">
      <CardIcon className="size-9 rounded-lg [&_svg]:size-[18px]">{icon}</CardIcon>
      <div className="min-w-0">
        <h4 className="text-sm font-semibold">{title}</h4>
        <p className="mt-1 text-sm leading-relaxed text-fg-muted">{body}</p>
      </div>
    </div>
  )
}

export function AdvisoryActionCard({
  advisory,
  plotName,
  advisoryId,
  acknowledged,
  onAcknowledge,
  acknowledging,
  isStale,
  ground,
}: Props) {
  const t = useTranslations('farmer')
  const ta = useTranslations('advisory')
  const tr = useTranslations('risk')
  const tp = useTranslations('pdsi')
  const tb = useTranslations('ensoBand')
  const level = advisory.risk_level as RiskLevel
  const GroundIcon = ground ? PDSI_ICON[ground] : null
  const Icon = RISK_ICON[level]

  return (
    <section
      aria-labelledby="advisory-heading"
      aria-busy={isStale}
      data-testid="advisory-action-card"
      className={cn(
        'flex flex-col gap-5 rounded-2xl border border-l-4 p-4 shadow-sm transition-opacity sm:p-6',
        RISK_SOFT_CLASS[level],
        RISK_ACCENT_BORDER[level],
        isStale && 'opacity-60',
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3.5">
          <span className={cn('mt-0.5 shrink-0', RISK_TEXT_CLASS[level])} aria-hidden>
            <Icon className="size-9 sm:size-11" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wider text-fg-muted uppercase">
              {plotName ? t('adviceForPlot', { plot: plotName }) : t('adviceTitle')}
            </p>
            <h2 id="advisory-heading" className={cn('font-display text-display-sm font-bold', RISK_TEXT_CLASS[level])}>
              {tr(level)}
            </h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-fg-muted">
              <span className="capitalize">{ta(`crops.${advisory.crop}.label`)}</span>
              <span className="text-border-strong">·</span>
              <span>{advisory.target_date}</span>
              <span className="text-border-strong">·</span>
              <span>{advisory.season}</span>
              {advisory.enso_category && (
                <>
                  <span className="text-border-strong">·</span>
                  <span>{tb(ensoKey(advisory.enso_category))}</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="shrink-0 sm:text-right">
          <div className="font-display text-stat font-bold tabular">{formatPercent(advisory.adjusted_probability)}</div>
          <p className="text-xs text-fg-muted">{t('chanceOfDrought', { crop: ta(`crops.${advisory.crop}.label`) })}</p>
          {/* Today's measured soil state, separated by a rule so it cannot be read as part of
              the forecast figure above it. */}
          {ground && GroundIcon && (
            <p className="mt-2.5 border-t border-fg/10 pt-2.5 sm:flex sm:justify-end">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-raised px-2.5 py-1 text-sm font-medium text-fg">
                <span className={cn('size-2.5 shrink-0 rounded-full', PDSI_DOT_CLASS[ground])} aria-hidden />
                <GroundIcon className="size-4 shrink-0 text-fg-muted" aria-hidden />
                {t('groundNow', { band: tp(pdsiKey(ground)) })}
              </span>
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Directive icon={<Wheat />} title={ta('strategyTitle')} body={advisory.crop_recommendation} />
        <Directive icon={<Clock />} title={ta('plantingTitle')} body={advisory.planting_window} />
        <Directive icon={<Droplets />} title={ta('waterTitle')} body={advisory.water_management} />
        <Directive icon={<AlertTriangle />} title={ta('prepTitle')} body={advisory.preparedness_action} />
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-dashed border-border-strong bg-surface-raised/70 p-3.5 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2 text-sm">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-brand-ochre" aria-hidden />
          <span className="text-fg-muted">{advisory.iek_assessment}</span>
        </p>
        <Badge variant="outline" size="lg" className="shrink-0 self-start sm:self-auto">
          <ShieldCheck className="text-primary" /> {advisory.confidence_level}
        </Badge>
      </div>

      {advisoryId &&
        onAcknowledge &&
        (acknowledged ? (
          // Once it is done this is a confirmation, not a control: a disabled button is both
          // unreadable against the risk panel and announced poorly by screen readers.
          <p
            role="status"
            className="flex items-center gap-2 text-base font-semibold text-primary sm:self-start"
          >
            <Check className="size-5 shrink-0" aria-hidden />
            {t('acknowledged')}
          </p>
        ) : (
          <Button
            size="lg"
            className="h-12 w-full text-base sm:w-auto sm:self-start"
            disabled={acknowledging}
            onClick={onAcknowledge}
          >
            <Check /> {t('acknowledge')}
          </Button>
        ))}
    </section>
  )
}
