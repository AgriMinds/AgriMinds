'use client'

import { CloudDrizzle, Cpu, Mountain, Target } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { DroughtMapResponse, LeadMonth } from '@agriminds/api-types'
import { Skeleton } from '@/components/ui/skeleton'
import { ProvenanceBanner } from '@/features/summary/ProvenanceBanner'
import { formatPercent } from '@/lib/utils'

type Props = { mapData?: DroughtMapResponse; isLoading: boolean; selectedLead: LeadMonth }

function Tile({
  icon,
  label,
  value,
  sub,
  tone,
  loading,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
  tone: string
  loading?: boolean
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-surface-raised p-3.5 shadow-xs transition-shadow hover:shadow-sm sm:p-5 2xl:p-6">
      <div className="flex items-center gap-2 text-[11px] font-semibold text-fg-muted sm:text-xs">
        <div
          className={`flex size-6 shrink-0 items-center justify-center rounded-lg sm:size-7 [&_svg]:size-3.5 sm:[&_svg]:size-4 ${tone}`}
        >
          {icon}
        </div>
        <span className="truncate">{label}</span>
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-8 w-24" />
      ) : (
        <div className="mt-2 truncate text-2xl font-black tracking-tight sm:text-3xl lg:text-4xl">
          {value}
        </div>
      )}
      <div className="mt-1 truncate text-[10px] text-fg-subtle sm:text-xs">{sub}</div>
    </div>
  )
}

export function WatershedSummary({ mapData, isLoading, selectedLead }: Props) {
  const t = useTranslations('summary')
  const tc = useTranslations('common')
  return (
    <div className="flex flex-col gap-4">
      <ProvenanceBanner provenance={mapData?.provenance} />
      <section aria-label={t('basinMeanRisk')} className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
        <Tile
          icon={<CloudDrizzle />}
          label={t('basinMeanRisk')}
          value={formatPercent(mapData?.mean_probability)}
          sub={`${t('spread')}: ${formatPercent(mapData?.min_probability)} (${t('min')}) – ${formatPercent(mapData?.max_probability)} (${t('max')})`}
          tone="bg-primary/15 text-primary"
          loading={isLoading && !mapData}
        />
        <Tile
          icon={<Target />}
          label={t('forecastTarget')}
          value={mapData?.target_date ?? `+${tc('months', { count: selectedLead })}`}
          sub={t('leadAdvance', { lead: selectedLead })}
          tone="bg-risk-moderate-soft text-fg"
          loading={isLoading && !mapData}
        />
        <Tile
          icon={<Mountain />}
          label={t('basinName')}
          value={t('chokeMountain')}
          sub={t('elevation')}
          tone="bg-brand-sage/40 text-brand-forest dark:text-brand-sage"
        />
        <Tile
          icon={<Cpu />}
          label={t('aiFramework')}
          value={t('superHybrid')}
          sub={t('aiComponents')}
          tone="bg-brand-lime/40 text-brand-forest dark:text-brand-lime"
        />
      </section>
    </div>
  )
}
