'use client'

import { useMemo, useState } from 'react'
import { Plus, Sprout, Waves } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import type { Farm, LeadMonth } from '@agriminds/api-types'
import { LEAD_MONTHS } from '@agriminds/api-types'
import { Button } from '@/components/ui/button'
import { QueryError } from '@/components/ui/query-state'
import { SegmentedControl } from '@/components/ui/segmented'
import { Skeleton } from '@/components/ui/skeleton'
import { AdvisoryActionCard } from '@/features/farmer/AdvisoryActionCard'
import { PlotCard } from '@/features/farmer/PlotCard'
import { PlotDialog } from '@/features/farmer/PlotDialog'
import { useAcknowledge, useFarmAdvisory, useFarmerDashboard } from '@/features/farmer/useFarmer'
import { localeName } from '@/features/ministry/useMinistry'
import { ProvenanceBanner } from '@/features/summary/ProvenanceBanner'
import { ensoKey } from '@/lib/classification'

type DialogState = { open: false } | { open: true; farm: Farm | null }

export function FarmerDashboard() {
  const t = useTranslations('farmer')
  const tg = useTranslations('grid')
  const tb = useTranslations('ensoBand')
  const [lead, setLead] = useState<LeadMonth>(1)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dialog, setDialog] = useState<DialogState>({ open: false })

  const locale = useLocale()
  const dashboard = useFarmerDashboard(lead)
  const data = dashboard.data
  const farms = useMemo(() => data?.farms ?? [], [data])

  // The API advises on the plot that needs attention first; the farmer can pick another.
  const activeId = selectedId ?? data?.advisory_farm_id ?? null
  const usingDefault = activeId === (data?.advisory_farm_id ?? null)
  const picked = useFarmAdvisory(activeId, lead, !usingDefault)
  const advisory = usingDefault ? data?.advisory : picked.data
  const activeFarm = farms.find((f) => f.id === activeId)
  const woreda = data?.user.woreda

  // The dashboard and the per-plot endpoint both identify the advisory record they wrote,
  // which is what the acknowledge endpoint takes.
  const recordId = usingDefault ? (data?.advisory_record_id ?? null) : (picked.data?.record_id ?? null)
  const serverAcknowledgedAt = usingDefault
    ? (data?.advisory_acknowledged_at ?? null)
    : (picked.data?.acknowledged_at ?? null)

  const acknowledge = useAcknowledge()
  // Keeps the button settled while the refetch that confirms it is still in flight.
  const [justAcknowledged, setJustAcknowledged] = useState<Set<string>>(new Set())
  const acknowledged = Boolean(
    serverAcknowledgedAt || (recordId && justAcknowledged.has(recordId)),
  )

  const leadLabel = (l: LeadMonth) => (
    <>
      <span className="sm:hidden">{tg(`lead${l}Short`)}</span>
      <span className="hidden sm:inline">{tg(`lead${l}`)}</span>
    </>
  )

  return (
    <>
      <div className="bg-contour border-b border-border">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-4 px-4 pt-8 pb-7 sm:px-6 lg:px-8">
          <div className="reveal">
            <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
              {woreda ? localeName(woreda, locale) : t('eyebrow')}
            </p>
            <h1 className="mt-2 font-display text-display font-bold">
              {data ? t('greeting', { name: data.user.full_name.split(' ')[0] ?? '' }) : t('greetingPlain')}
            </h1>
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-fg-muted sm:text-base">{t('intro')}</p>
          </div>
          <div className="reveal flex flex-wrap items-center gap-3" style={{ '--reveal-delay': '80ms' } as React.CSSProperties}>
            <SegmentedControl
              aria-label={tg('leadGroup')}
              value={lead}
              onChange={setLead}
              options={LEAD_MONTHS.map((l) => ({ value: l, label: leadLabel(l) }))}
            />
            {/* The ocean as it is today. The advisory card carries the band for the month the
                advice covers, which is a different reading and often a different band. */}
            {data?.enso_category && (
              <span className="flex items-center gap-1.5 text-xs text-fg-muted">
                <Waves className="size-3.5 text-primary" aria-hidden />
                {t('ensoNowBand', { band: tb(ensoKey(data.enso_category)) })}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <ProvenanceBanner provenance={data?.provenance ?? undefined} className="reveal" />

        {dashboard.error && !data ? (
          <QueryError error={dashboard.error} onRetry={() => void dashboard.refetch()} isRetrying={dashboard.isFetching} />
        ) : dashboard.isPending && !data ? (
          <div className="flex flex-col gap-4" aria-busy>
            <Skeleton className="h-64 rounded-2xl" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} className="h-44 rounded-2xl" />
              ))}
            </div>
          </div>
        ) : (
          <>
            {advisory ? (
              <div id="advice" className="scroll-mt-24">
              <AdvisoryActionCard
                advisory={advisory}
                plotName={activeFarm?.name}
                advisoryId={recordId}
                acknowledged={acknowledged}
                acknowledging={acknowledge.isPending}
                onAcknowledge={() => {
                  if (!recordId) return
                  setJustAcknowledged((prev) => new Set(prev).add(recordId))
                  acknowledge.mutate(recordId)
                }}
                ground={activeFarm?.risk?.pdsi_category ?? null}
                isStale={dashboard.isFetching || picked.isFetching}
              />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border-strong bg-surface-raised/50 px-6 py-12 text-center">
                <span className="flex size-12 items-center justify-center rounded-xl bg-surface-sunken text-fg-subtle" aria-hidden>
                  <Sprout className="size-6" />
                </span>
                <h2 className="font-display text-base font-semibold">{t('noPlotsTitle')}</h2>
                <p className="max-w-sm text-sm text-fg-muted">{t('noPlotsBody')}</p>
                <Button size="lg" className="mt-1 h-12" onClick={() => setDialog({ open: true, farm: null })}>
                  <Plus /> {t('addPlot')}
                </Button>
              </div>
            )}

            {farms.length > 0 && (
              <section id="plots" aria-labelledby="plots-heading" className="flex scroll-mt-24 flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <h2 id="plots-heading" className="font-display text-lg font-semibold">
                    {t('myPlots', { count: farms.length })}
                  </h2>
                  <Button variant="outline" onClick={() => setDialog({ open: true, farm: null })}>
                    <Plus /> {t('addPlot')}
                  </Button>
                </div>
                <p className="text-sm text-fg-muted">{t('plotsHint')}</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {farms.map((farm) => (
                    <PlotCard
                      key={farm.id}
                      farm={farm}
                      selected={farm.id === activeId}
                      onSelect={() => setSelectedId(farm.id)}
                      onEdit={() => setDialog({ open: true, farm })}
                      ground={farm.risk?.pdsi_category ?? null}
                    />
                  ))}
                </div>
              </section>
            )}

            {data?.enso_summary && (
              <p
                id="season"
                className="scroll-mt-24 rounded-xl border border-border bg-surface-raised p-4 text-sm leading-relaxed text-fg-muted"
              >
                <Waves className="mr-2 inline size-4 text-primary" aria-hidden />
                {data.enso_summary}
              </p>
            )}
          </>
        )}
      </div>

      {dialog.open && <PlotDialog farm={dialog.farm} lead={lead} onClose={() => setDialog({ open: false })} />}
    </>
  )
}
