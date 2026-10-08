'use client'

import { Info, Sprout } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { ObservedConditions as Conditions } from '@agriminds/api-types'
import {
  Card,
  CardActions,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardHeading,
  CardIcon,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PDSI_CELL_CLASS, PDSI_DOT_CLASS, PDSI_ICON, formatPdsi, pdsiKey } from '@/lib/classification'
import { cn } from '@/lib/utils'

/**
 * How dry the ground already is — a measurement, not a projection.
 *
 * It sits apart from the forecast cards on purpose, and every label here says "now" or
 * "measured", because the one mistake worth designing against is reading this index as the
 * model's probability of drought next season.
 */
export function ObservedConditions({ conditions }: { conditions?: Conditions | null }) {
  const t = useTranslations('conditions')
  const tp = useTranslations('pdsi')
  if (!conditions) return null

  const MeanIcon = PDSI_ICON[conditions.category]
  const DriestIcon = PDSI_ICON[conditions.driest_category]

  return (
    <Card data-testid="observed-conditions">
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
          <Badge variant="outline">{t('asOf', { month: conditions.as_of })}</Badge>
        </CardActions>
      </CardHeader>

      <CardContent>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-surface-sunken/50 p-4">
            <p className="text-[11px] font-semibold tracking-wider text-fg-muted uppercase">{t('basinMean')}</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-display text-stat font-bold tabular">{formatPdsi(conditions.mean)}</span>
              <span className="font-mono text-[11px] text-fg-subtle">{tp('scaleName')}</span>
            </div>
            <span
              className={cn(
                'mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
                PDSI_CELL_CLASS[conditions.category],
              )}
            >
              <MeanIcon className="size-3.5 shrink-0" aria-hidden />
              {tp(pdsiKey(conditions.category))}
            </span>
          </div>

          <div className="rounded-xl border border-border bg-surface-sunken/50 p-4">
            <p className="text-[11px] font-semibold tracking-wider text-fg-muted uppercase">{t('driest')}</p>
            <span
              className={cn(
                'mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold',
                PDSI_CELL_CLASS[conditions.driest_category],
              )}
            >
              <DriestIcon className="size-4 shrink-0" aria-hidden />
              {tp(pdsiKey(conditions.driest_category))}
            </span>
          </div>

          <div className="rounded-xl border border-border bg-surface-sunken/50 p-4">
            <p className="text-[11px] font-semibold tracking-wider text-fg-muted uppercase">{t('inDrought')}</p>
            <div className="mt-1 font-display text-stat font-bold tabular">{conditions.cells_in_drought}</div>
            <p className="mt-1 text-xs text-fg-subtle">{t('ofCells', { total: 64 })}</p>
            <div className="mt-2 flex h-1.5 gap-0.5 overflow-hidden rounded-full" aria-hidden>
              {Array.from({ length: 64 }, (_, i) => (
                <span
                  key={i}
                  className={cn('flex-1', i < conditions.cells_in_drought ? PDSI_DOT_CLASS['Very dry'] : 'bg-surface-sunken')}
                />
              ))}
            </div>
          </div>
        </div>

        <p className="flex items-start gap-2.5 text-xs leading-relaxed text-fg-muted">
          <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          {t('explain')}
        </p>
      </CardContent>

      <CardFooter className="flex-col items-start gap-1 text-[10px] text-fg-subtle">
        <span>
          {t('methodLabel')}: {conditions.method_note}
        </span>
        <span>
          {t('sourceLabel')}: {conditions.citation} · <span className="font-mono">{conditions.classification_version}</span>
        </span>
      </CardFooter>
    </Card>
  )
}
