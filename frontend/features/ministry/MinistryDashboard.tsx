'use client'

import { useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { ArrowRight, Flame, Map, Sprout, Users, Wheat } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import type { LeadMonth } from '@agriminds/api-types'
import { LEAD_MONTHS } from '@agriminds/api-types'
import { Card, CardContent, CardDescription, CardHeader, CardHeading, CardIcon, CardTitle } from '@/components/ui/card'
import { QueryError } from '@/components/ui/query-state'
import { SegmentedControl } from '@/components/ui/segmented'
import { Skeleton } from '@/components/ui/skeleton'
import { Stat } from '@/components/ui/stat'
import { CropMix } from '@/features/ministry/CropMix'
import { DeliveryCard } from '@/features/ministry/DeliveryCard'
import { ExposureBreakdown } from '@/features/ministry/ExposureBreakdown'
import { WoredaTable } from '@/features/ministry/WoredaTable'
import { useMinistryDashboard } from '@/features/ministry/useMinistry'
import { ProvenanceBanner } from '@/features/summary/ProvenanceBanner'

const delay = (ms: number): CSSProperties => ({ '--reveal-delay': `${ms}ms` }) as CSSProperties

export function MinistryDashboard() {
  const t = useTranslations('ministry')
  const tg = useTranslations('grid')
  const format = useFormatter()
  const [lead, setLead] = useState<LeadMonth>(1)
  const query = useMinistryDashboard(lead)
  const data = query.data
  const coverage = data?.coverage
  const loading = query.isPending && !data

  const leadLabel = (l: LeadMonth) => (
    <>
      <span className="sm:hidden">{tg(`lead${l}Short`)}</span>
      <span className="hidden sm:inline">{tg(`lead${l}`)}</span>
    </>
  )

  return (
    <>
      <div className="bg-contour border-b border-border">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-4 pt-8 pb-7 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-8 lg:pt-10">
          <div className="reveal max-w-2xl">
            <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
              {data?.scope ?? t('eyebrow')}
            </p>
            <h1 className="mt-2 font-display text-display font-bold">{t('title')}</h1>
            <p className="mt-2 text-sm leading-relaxed text-fg-muted sm:text-base">{t('intro')}</p>
          </div>
          <div className="reveal flex flex-col gap-2 sm:items-end" style={delay(80)}>
            <SegmentedControl
              aria-label={tg('leadGroup')}
              value={lead}
              onChange={setLead}
              options={LEAD_MONTHS.map((l) => ({ value: l, label: leadLabel(l) }))}
            />
            {data && (
              <p className="text-xs text-fg-muted">
                {t('generatedAt', { time: format.dateTime(new Date(data.generated_at), 'short') })}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-[1600px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <ProvenanceBanner provenance={data?.provenance ?? undefined} className="reveal" style={delay(120)} />

        {query.error && !data ? (
          <QueryError error={query.error} onRetry={() => void query.refetch()} isRetrying={query.isFetching} />
        ) : (
          <>
            <section
              aria-label={t('coverageTitle')}
              className="reveal grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
              style={delay(160)}
            >
              <Stat
                icon={<Users />}
                label={t('registeredFarmers')}
                value={coverage?.farmers ?? '—'}
                loading={loading}
                detail={coverage ? t('activeLast30', { count: coverage.active_farmers_30d }) : undefined}
              />
              <Stat
                icon={<Sprout />}
                label={t('registeredPlots')}
                value={coverage?.farms ?? '—'}
                loading={loading}
                detail={coverage ? t('hectaresTotal', { hectares: coverage.hectares.toFixed(1) }) : undefined}
              />
              <Stat
                icon={<Map />}
                label={t('woredasCovered')}
                value={coverage ? `${coverage.woredas_covered}/${coverage.woredas_total}` : '—'}
                loading={loading}
                detail={t('woredasDetail')}
              />
              <Stat
                icon={<Flame />}
                label={t('plotsAtRisk')}
                tone="bg-risk-high-soft text-risk-high"
                value={data?.exposure ? data.exposure.farms_at_risk : '—'}
                loading={loading}
                detail={
                  data?.exposure
                    ? t('atRiskDetail', {
                        farmers: data.exposure.farmers_at_risk,
                        hectares: data.exposure.hectares_at_risk.toFixed(1),
                      })
                    : t('exposureUnavailable')
                }
              />
            </section>

            <p className="reveal text-xs text-fg-subtle" style={delay(180)}>
              {t('sourceNote')}
            </p>

            {/* Two independent columns so a short card never leaves a hole beside a tall one. */}
            <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
              <div className="flex flex-col gap-6 xl:col-span-5">
                <Card className="reveal" style={delay(220)}>
                  <CardHeader>
                    <CardHeading>
                      <CardIcon>
                        <Flame />
                      </CardIcon>
                      <div className="min-w-0">
                        <CardTitle>{t('exposureCardTitle')}</CardTitle>
                        <CardDescription>{t('exposureCardSubtitle')}</CardDescription>
                      </div>
                    </CardHeading>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <Skeleton className="h-52" />
                    ) : data?.exposure ? (
                      <ExposureBreakdown exposure={data.exposure} />
                    ) : (
                      <p className="rounded-xl border border-dashed border-border-strong px-4 py-8 text-center text-sm text-fg-muted">
                        {t('exposureUnavailable')}
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card className="reveal" style={delay(300)}>
                  <CardHeader>
                    <CardHeading>
                      <CardIcon>
                        <Wheat />
                      </CardIcon>
                      <div className="min-w-0">
                        <CardTitle>{t('cropMixTitle')}</CardTitle>
                        <CardDescription>{t('cropMixSubtitle')}</CardDescription>
                      </div>
                    </CardHeading>
                  </CardHeader>
                  <CardContent>
                    {loading ? <Skeleton className="h-40" /> : <CropMix entries={data?.crop_mix ?? []} />}
                  </CardContent>
                </Card>
              </div>

              <div className="flex flex-col gap-6 xl:col-span-7">
                <Card className="reveal" style={delay(260)}>
                  <CardHeader>
                    <CardHeading>
                      <CardIcon>
                        <Map />
                      </CardIcon>
                      <div className="min-w-0">
                        <CardTitle>{t('byWoredaTitle')}</CardTitle>
                        <CardDescription>{t('byWoredaSubtitle')}</CardDescription>
                      </div>
                    </CardHeading>
                  </CardHeader>
                  <CardContent>
                    {loading ? <Skeleton className="h-52" /> : <WoredaTable rows={data?.by_woreda ?? []} />}
                  </CardContent>
                </Card>

                <Card className="reveal" style={delay(340)}>
                  <CardHeader>
                    <CardHeading>
                      <CardIcon>
                        <Users />
                      </CardIcon>
                      <div className="min-w-0">
                        <CardTitle>{t('deliveryTitle')}</CardTitle>
                        <CardDescription>{t('deliverySubtitle')}</CardDescription>
                      </div>
                    </CardHeading>
                  </CardHeader>
                  <CardContent>
                    {loading ? <Skeleton className="h-32" /> : data && <DeliveryCard delivery={data.advisories} />}
                  </CardContent>
                </Card>
              </div>
            </div>

            <Link
              href="/watershed"
              className="reveal flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface-raised p-4 shadow-sm transition-colors hover:border-border-strong hover:bg-surface-sunken focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:p-5"
              style={delay(380)}
            >
              <span className="min-w-0">
                <span className="block font-display text-base font-semibold">{t('watershedLinkTitle')}</span>
                <span className="mt-0.5 block text-sm text-fg-muted">{t('watershedLinkBody')}</span>
              </span>
              <ArrowRight className="size-5 shrink-0 text-primary" aria-hidden />
            </Link>
          </>
        )}
      </div>
    </>
  )
}
