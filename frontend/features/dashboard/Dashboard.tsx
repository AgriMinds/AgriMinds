'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { Crop, LeadMonth } from '@agriminds/api-types'
import { CropDecisionPanel } from '@/features/advisory/CropDecisionPanel'
import { useAdvisory } from '@/features/advisory/useAdvisory'
import { WatershedGridMap, type Cell } from '@/features/drought/WatershedGridMap'
import { useDroughtMap } from '@/features/drought/useDroughtMap'
import { EnsoMonitor } from '@/features/enso/EnsoMonitor'
import { useEnsoOutlook } from '@/features/enso/useEnsoOutlook'
import { ReportsPlaceholder } from '@/features/summary/ReportsPlaceholder'
import { WatershedSummary } from '@/features/summary/WatershedSummary'

/** Holds the dashboard's UI state (lead, cell, crop, IEK) and wires queries to feature components. */
export function Dashboard() {
  const t = useTranslations('app.nav')
  const [lead, setLead] = useState<LeadMonth>(1)
  const [cell, setCell] = useState<Cell>({ row: 4, col: 4 })
  const [crop, setCrop] = useState<Crop>('tef')
  const [iekAgrees, setIekAgrees] = useState<boolean | null>(null)

  const map = useDroughtMap(lead)
  const advisory = useAdvisory({
    crop,
    lead_month: lead,
    row: cell.row,
    col: cell.col,
    iek_agrees: iekAgrees,
  })
  const enso = useEnsoOutlook()

  return (
    <div className="flex flex-col gap-6">
      <section id="overview" aria-label={t('overview')} className="scroll-mt-24">
        <WatershedSummary mapData={map.data} isLoading={map.isPending} selectedLead={lead} />
      </section>
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        <section id="drought" aria-label={t('drought')} className="scroll-mt-24 xl:col-span-5">
          <WatershedGridMap
            mapData={map.data}
            isLoading={map.isPending}
            isFetching={map.isFetching}
            error={map.error}
            onRetry={() => void map.refetch()}
            selectedLead={lead}
            onLeadChange={setLead}
            selectedCell={cell}
            onCellSelect={setCell}
          />
        </section>
        <section id="advisories" aria-label={t('advisories')} className="scroll-mt-24 xl:col-span-7">
          <CropDecisionPanel
            crop={crop}
            onCropChange={setCrop}
            iekAgrees={iekAgrees}
            onIekChange={setIekAgrees}
            advisory={advisory.data}
            isLoading={advisory.isPending}
            isFetching={advisory.isFetching}
            error={advisory.error}
            onRetry={() => void advisory.refetch()}
          />
        </section>
      </div>
      <section id="enso" aria-label={t('enso')} className="scroll-mt-24">
        <EnsoMonitor
          data={enso.data}
          isLoading={enso.isPending}
          isFetching={enso.isFetching}
          error={enso.error}
          onRetry={() => void enso.refetch()}
        />
      </section>
      <section id="reports" aria-label={t('reports')} className="scroll-mt-24">
        <ReportsPlaceholder />
      </section>
    </div>
  )
}
