import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { isStaff } from '@agriminds/api-types'
import { AnalyticsPage } from '@/features/analytics/AnalyticsPage'
import { getSession } from '@/lib/server/session'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('nav')
  return { title: t('analytics') }
}

/** The analytics dashboard for ministry staff. Farmers are sent back to their own dashboard. */
export default async function Analytics() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!isStaff(session.user.role)) redirect('/farm')
  return <AnalyticsPage role={session.user.role} />
}
