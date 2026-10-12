'use client'

import { CircleAlert, FlaskConical, Scale } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { CropYieldModelCard } from '@agriminds/api-types'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardHeading,
  CardIcon,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

/**
 * The model's own account of itself: its stated limits, every candidate's holdout score, and the
 * features it actually splits on. The caveats are read from the trained artifact rather than
 * written here, so they cannot drift away from the model they describe.
 */
export function ModelLimits({ card }: { card: CropYieldModelCard }) {
  const t = useTranslations('cropYield')
  const worst = Math.max(...card.feature_importance.map((f) => f.importance), 0.0001)

  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:gap-4">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardHeading>
            <CardIcon className="bg-status-warn/15 text-status-warn">
              <CircleAlert />
            </CardIcon>
            <div className="min-w-0">
              <CardTitle>{t('limitsTitle')}</CardTitle>
              <CardDescription>{t('limitsDesc')}</CardDescription>
            </div>
          </CardHeading>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2.5">
            {card.caveats.map((caveat) => (
              <li key={caveat} className="flex gap-2.5 text-sm leading-relaxed text-fg-muted">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-status-warn" aria-hidden />
                <span>{caveat}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardHeading>
            <CardIcon>
              <Scale />
            </CardIcon>
            <div className="min-w-0">
              <CardTitle>{t('candidatesTitle')}</CardTitle>
              <CardDescription>
                {t('candidatesDesc', {
                  trainFrom: card.train_years[0] ?? '—',
                  trainTo: card.train_years[1] ?? '—',
                  testFrom: card.test_years[0] ?? '—',
                  testTo: card.test_years[1] ?? '—',
                  rows: card.test_rows,
                })}
              </CardDescription>
            </div>
          </CardHeading>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="text-xs text-fg-subtle">
              <tr>
                <th scope="col" className="py-1.5 text-left font-medium">
                  &nbsp;
                </th>
                <th scope="col" className="py-1.5 text-right font-medium">
                  RMSE
                </th>
                <th scope="col" className="py-1.5 text-right font-medium">
                  MAE
                </th>
                <th scope="col" className="py-1.5 text-right font-medium">
                  R²
                </th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {card.candidates.map((candidate) => (
                <tr key={candidate.model} className="border-t border-border">
                  <th scope="row" className="py-1.5 pr-2 text-left font-normal">
                    <span className={cn('flex items-center gap-2', candidate.selected && 'font-semibold')}>
                      <span className="truncate">{candidate.model}</span>
                      {candidate.selected && (
                        <Badge variant="outline" className="shrink-0">
                          {t('inUse')}
                        </Badge>
                      )}
                    </span>
                  </th>
                  <td className="py-1.5 text-right font-mono">{candidate.test_rmse.toFixed(2)}</td>
                  <td className="py-1.5 text-right font-mono">{candidate.test_mae.toFixed(2)}</td>
                  <td className="py-1.5 text-right font-mono">{candidate.test_r2.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardHeading>
            <CardIcon>
              <FlaskConical />
            </CardIcon>
            <div className="min-w-0">
              <CardTitle>{t('leansOnTitle')}</CardTitle>
              <CardDescription>{t('leansOnDesc')}</CardDescription>
            </div>
          </CardHeading>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2">
            {card.feature_importance.map((feature) => (
              <li key={feature.feature} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-3 text-xs">
                  <span className="truncate font-mono text-fg">{feature.feature}</span>
                  <span className="tabular-nums text-fg-muted">
                    {(feature.importance * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(feature.importance / worst) * 100}%` }}
                    aria-hidden
                  />
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
