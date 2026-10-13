'use client'

import { useTranslations } from 'next-intl'
import { Package, Rocket, Target } from 'lucide-react'
import type { PricingCatalogue } from '@agriminds/api-types'
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

/**
 * What is sold, to whom, and how it gets sold.
 *
 * The rate card above answers "how much". This answers the two questions a price alone cannot:
 * which package a segment actually receives, and how the business intends to win it. Keeping them
 * on one page is deliberate — a price with no product behind it is the thing that gets quoted and
 * then cannot be delivered.
 *
 * The products come from the API because they are records somebody maintains. The go-to-market
 * plan is written here because it is the strategy itself, not data about customers: it changes
 * when the business changes its mind, not when a row is edited.
 */
export function BusinessModel({ catalogue }: { catalogue: PricingCatalogue }) {
  const t = useTranslations('pricing.model')
  const ts = useTranslations('organizations.stakeholder')

  const steps = ['evidence', 'demo', 'action', 'economics', 'payment'] as const
  const pillars = ['farmer', 'revenue', 'scaling'] as const
  const phases = ['identify', 'pilot', 'partners'] as const

  return (
    <div className="flex flex-col gap-5">
      <Card className="p-3.5 sm:p-5">
        <CardHeader>
          <CardHeading>
            <CardIcon>
              <Package />
            </CardIcon>
            <div className="min-w-0">
              <CardTitle>{t('products')}</CardTitle>
              <CardDescription>{t('productsDesc')}</CardDescription>
            </div>
          </CardHeading>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-3 md:grid-cols-3">
            {catalogue.products?.map((product) => (
              <li key={product.code} className="flex flex-col gap-2 rounded-xl border border-border p-3">
                <span className="flex items-center gap-2">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-fg">
                    {product.code}
                  </span>
                  <span className="text-sm font-semibold">{product.name}</span>
                </span>
                <p className="text-xs leading-relaxed text-fg-muted">{product.summary}</p>
                <ul className="flex flex-wrap gap-1">
                  {product.stakeholders.map((who) => (
                    <li key={who}>
                      <Badge>{ts(who)}</Badge>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-3.5 sm:p-5">
          <CardHeader>
            <CardHeading>
              <CardIcon>
                <Target />
              </CardIcon>
              <div className="min-w-0">
                <CardTitle>{t('convince')}</CardTitle>
                <CardDescription>{t('convinceDesc')}</CardDescription>
              </div>
            </CardHeading>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ol className="flex flex-col gap-2">
              {steps.map((step, i) => (
                <li key={step} className="flex gap-2.5 text-sm">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-[11px] font-semibold tabular-nums">
                    {i + 1}
                  </span>
                  <span className="leading-snug">{t(`step.${step}`)}</span>
                </li>
              ))}
            </ol>

            <div className="flex flex-col gap-2 border-t border-border pt-3">
              <p className="text-xs font-semibold tracking-wide text-fg-muted uppercase">{t('pillars')}</p>
              <ul className="flex flex-col gap-1.5">
                {pillars.map((pillar) => (
                  <li key={pillar} className="text-sm leading-snug">
                    {t(`pillar.${pillar}`)}
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card className="p-3.5 sm:p-5">
          <CardHeader>
            <CardHeading>
              <CardIcon>
                <Rocket />
              </CardIcon>
              <div className="min-w-0">
                <CardTitle>{t('roadmap')}</CardTitle>
                <CardDescription>{t('roadmapDesc')}</CardDescription>
              </div>
            </CardHeading>
          </CardHeader>
          <CardContent>
            <ol className="flex flex-col gap-3">
              {phases.map((phase) => (
                <li key={phase} className="flex gap-3">
                  {/* A plain rail rather than a chart: three phases in order is a sequence, and a
                      sequence reads as a list faster than it reads as a drawing. */}
                  <span className="flex flex-col items-center" aria-hidden>
                    <span className="size-2 rounded-full bg-primary" />
                    <span className="w-px flex-1 bg-border" />
                  </span>
                  <span className="flex min-w-0 flex-col pb-1">
                    <span className="text-xs font-semibold tracking-wide text-primary uppercase">
                      {t(`phase.${phase}.days`)}
                    </span>
                    <span className="text-sm font-medium">{t(`phase.${phase}.title`)}</span>
                    <span className="text-xs leading-snug text-fg-muted">{t(`phase.${phase}.detail`)}</span>
                  </span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
