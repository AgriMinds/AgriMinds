'use client'

import { FlaskConical, Archive } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { ForecastProvenance } from '@agriminds/api-types'
import { cn } from '@/lib/utils'

/** Shown whenever the numbers on screen are not a live forecast from a model trained on real data. */
export function ProvenanceBanner({
  provenance,
  className,
}: {
  provenance?: ForecastProvenance
  className?: string
}) {
  const t = useTranslations('provenance')
  if (!provenance) return null
  const synthetic = provenance.data_source !== 'real'
  const precomputed = provenance.source !== 'model'
  if (!synthetic && !precomputed) return null
  return (
    <div
      role="status"
      data-testid="provenance-banner"
      className={cn(
        'flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-xs',
        synthetic
          ? 'border-brand-ochre/60 bg-brand-ochre/15 text-fg'
          : 'border-brand-clay/60 bg-brand-clay/15 text-fg',
        className,
      )}
    >
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-raised/80 text-brand-clay">
        {synthetic ? <FlaskConical className="size-4" /> : <Archive className="size-4" />}
      </div>
      <div className="min-w-0">
        <p className="font-bold">{synthetic ? t('syntheticTitle') : t('precomputedTitle')}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-fg-muted">
          {synthetic ? t('syntheticBody') : t('precomputedBody', { issued: provenance.issued_date })}
        </p>
        <p className="mt-1.5 font-mono text-[10px] text-fg-subtle">
          {t('model', { version: provenance.model_version })} ·{' '}
          {t('issued', { issued: provenance.issued_date })}
        </p>
      </div>
    </div>
  )
}
