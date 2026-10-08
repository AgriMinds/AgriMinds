import { FileText } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'

/** Honest empty state: the reporting service is not integrated, so no figures are shown. */
export function ReportsPlaceholder() {
  const t = useTranslations('reports')
  return (
    <Card aria-labelledby="reports-title">
      <CardContent className="items-center py-8 text-center">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-surface-sunken text-fg-subtle">
          <FileText className="size-6" />
        </div>
        <h2 id="reports-title" className="text-base font-bold">
          {t('emptyTitle')}
        </h2>
        <p className="max-w-prose text-xs leading-relaxed text-fg-muted">{t('emptyBody')}</p>
      </CardContent>
    </Card>
  )
}
