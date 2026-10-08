'use client'

import { useState, type CSSProperties } from 'react'
import { useTranslations } from 'next-intl'
import type { Crop, LeadMonth } from '@agriminds/api-types'
import { CropDecisionPanel } from '@/features/advisory/CropDecisionPanel'
import { ObservedConditions } from '@/features/conditions/ObservedConditions'
import { useAdvisory } from '@/features/advisory/useAdvisory'
import { ForecastControls } from '@/features/dashboard/ForecastControls'
import { WatershedGridMap, type Cell } from '@/features/drought/WatershedGridMap'
import { useDroughtMap } from '@/features/drought/useDroughtMap'
import { EnsoMonitor } from '@/features/enso/EnsoMonitor'
import { useEnsoOutlook } from '@/features/enso/useEnsoOutlook'
import { ProvenanceBanner } from '@/features/summary/ProvenanceBanner'
import { ReportsPlaceholder } from '@/features/summary/ReportsPlaceholder'
import { WatershedSummary } from '@/features/summary/WatershedSummary'

const delay = (ms: number): CSSProperties => ({ '--reveal-delay': `${ms}ms` }) as CSSProperties

/** Holds the dashboard's UI state (lead, cell, crop, IEK) and wires queries to feature components. */
export function Dashboard() {
  const t = useTranslations('app')
  const tn = useTranslations('app.nav')
  const [lead, setLead] = useState<LeadMonth>(1)
  const [cell, setCell] = useState<Cell>({ row: 4, col: 4 })
  const [crop, setCrop] = useState<Crop>('tef')
  const [iekAgrees, setIekAgrees] = useState<boolean | null>(null)

  const map = useDroughtMap(lead)
  const advisory = useAdvisory({ crop, lead_month: lead, row: cell.row, col: cell.col, iek_agrees: iekAgrees })
  const enso = useEnsoOutlook()

  return (
    <>
      {/* Page header with the global forecast control */}
      <div className="bg-contour border-b border-border">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-4 pt-8 pb-7 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-8 lg:pt-10">
          <div className="reveal max-w-2xl">
            <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">{t('eyebrow')}</p>
            <h1 className="mt-2 font-display text-display font-bold text-fg">{t('greeting')}</h1>
            <p className="mt-2 text-sm leading-relaxed text-fg-muted sm:text-base">{t('intro')}</p>
          </div>
          <div className="reveal" style={delay(80)}>
            <ForecastControls lead={lead} onLeadChange={setLead} map={map.data} />
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-[1600px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <ProvenanceBanner provenance={map.data?.provenance} className="reveal" style={delay(120)} />

        <section id="overview" aria-label={tn('overview')} className="reveal scroll-mt-20" style={delay(160)}>
          <WatershedSummary
            mapData={map.data}
            ensoData={enso.data}
            isLoading={map.isPending}
            selectedLead={lead}
            onSelectCell={setCell}
          />
        </section>

        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
          <section id="drought" aria-label={tn('drought')} className="reveal scroll-mt-20 xl:col-span-6 2xl:col-span-5" style={delay(220)}>
            <WatershedGridMap
              mapData={map.data}
              isLoading={map.isPending}
              isFetching={map.isFetching}
              error={map.error}
              onRetry={() => void map.refetch()}
              selectedLead={lead}
              selectedCell={cell}
              onCellSelect={setCell}
            />
          </section>
          <section id="advisories" aria-label={tn('advisories')} className="reveal scroll-mt-20 xl:col-span-6 2xl:col-span-7" style={delay(280)}>
            <CropDecisionPanel
              crop={crop}
              onCropChange={setCrop}
              iekAgrees={iekAgrees}
              onIekChange={setIekAgrees}
              cell={cell}
              advisory={advisory.data}
              isLoading={advisory.isPending}
              isFetching={advisory.isFetching}
              error={advisory.error}
              onRetry={() => void advisory.refetch()}
            />
          </section>
        </div>

        {/* Measured ground state. Hidden entirely when the server has no climate record. */}
        {map.data?.conditions && (
          <section id="conditions" aria-label={t('conditionsSection')} className="reveal scroll-mt-20" style={delay(320)}>
            <ObservedConditions conditions={map.data.conditions} />
          </section>
        )}

        <section id="enso" aria-label={tn('enso')} className="reveal scroll-mt-20" style={delay(360)}>
          <EnsoMonitor data={enso.data} isLoading={enso.isPending} isFetching={enso.isFetching} error={enso.error} onRetry={() => void enso.refetch()} />
        </section>

        <section id="reports" aria-label={tn('reports')} className="reveal scroll-mt-20" style={delay(420)}>
          <ReportsPlaceholder />
        </section>
      </div>
    </>
  )
}
