import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { homePathFor } from '@agriminds/api-types'
import { FarmerDashboard } from '@/features/farmer/FarmerDashboard'
import { getSession } from '@/lib/server/session'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('nav')
  return { title: t('farm') }
}

export default async function FarmPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.user.role !== 'farmer') redirect(homePathFor(session.user.role))
  return <FarmerDashboard />
}
