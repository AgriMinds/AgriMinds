'use client'

import type { CSSProperties } from 'react'
import { Archive, FlaskConical } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { ForecastProvenance } from '@agriminds/api-types'
import { cn } from '@/lib/utils'

/** Shown whenever the numbers on screen are not a live forecast from a model trained on real data. */
export function ProvenanceBanner({
  provenance,
  className,
  style,
}: {
  provenance?: ForecastProvenance
  className?: string
  style?: CSSProperties
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
      style={style}
      className={cn(
        'flex items-start gap-3 rounded-xl border border-l-4 px-4 py-3 text-sm',
        synthetic ? 'border-brand-ochre/50 border-l-brand-ochre bg-brand-ochre/10' : 'border-brand-clay/50 border-l-brand-clay bg-brand-clay/10',
        className,
      )}
    >
      <span className="mt-0.5 text-brand-clay" aria-hidden>
        {synthetic ? <FlaskConical className="size-4" /> : <Archive className="size-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{synthetic ? t('syntheticTitle') : t('precomputedTitle')}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-fg-muted">
          {synthetic ? t('syntheticBody') : t('precomputedBody', { issued: provenance.issued_date })}
        </p>
      </div>
      <p className="hidden shrink-0 self-center font-mono text-[11px] text-fg-subtle md:block">
        {t('model', { version: provenance.model_version })} · {t('issued', { issued: provenance.issued_date })}
      </p>
    </div>
  )
}
