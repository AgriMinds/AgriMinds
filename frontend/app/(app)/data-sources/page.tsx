import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { isStaff } from '@agriminds/api-types'
import { DataSourcesPage } from '@/features/system/DataSourcesPage'
import { getSession } from '@/lib/server/session'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('nav')
  return { title: t('dataSources') }
}

/** Provenance for ministry staff. A farmer sees the forecast's caveat on their own dashboard instead. */
export default async function DataSources() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!isStaff(session.user.role)) redirect('/farm')
  return <DataSourcesPage />
}
