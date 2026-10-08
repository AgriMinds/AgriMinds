import { getTranslations } from 'next-intl/server'
import { Shell } from '@/components/layout/Shell'
import { Dashboard } from '@/features/dashboard/Dashboard'

export default async function HomePage() {
  const t = await getTranslations('app')
  return (
    <Shell>
      <div className="mb-6 flex flex-col gap-1">
        <h2 className="text-2xl font-black tracking-tight sm:text-3xl">{t('greeting')}</h2>
        <p className="max-w-2xl text-sm text-fg-muted">{t('intro')}</p>
      </div>
      <Dashboard />
    </Shell>
  )
}
