import { FileText } from 'lucide-react'
import { useTranslations } from 'next-intl'

/** Honest empty state: the reporting service is not integrated, so no figures are shown. */
export function ReportsPlaceholder() {
  const t = useTranslations('reports')
  return (
    <div
      aria-labelledby="reports-title"
      className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border-strong bg-surface-raised/50 px-6 py-10 text-center"
    >
      <span className="flex size-11 items-center justify-center rounded-xl bg-surface-sunken text-fg-subtle" aria-hidden>
        <FileText className="size-5" />
      </span>
      <h2 id="reports-title" className="font-display text-base font-semibold">
        {t('emptyTitle')}
      </h2>
      <p className="max-w-md text-sm leading-relaxed text-fg-muted">{t('emptyBody')}</p>
    </div>
  )
}
