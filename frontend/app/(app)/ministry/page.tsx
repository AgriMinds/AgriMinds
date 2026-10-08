import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { isStaff } from '@agriminds/api-types'
import { MinistryDashboard } from '@/features/ministry/MinistryDashboard'
import { getSession } from '@/lib/server/session'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('nav')
  return { title: t('ministry') }
}

export default async function MinistryPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!isStaff(session.user.role)) redirect('/farm')
  return <MinistryDashboard />
}
