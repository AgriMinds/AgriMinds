import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { isStaff } from '@agriminds/api-types'
import { Dashboard } from '@/features/dashboard/Dashboard'
import { getSession } from '@/lib/server/session'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('nav')
  return { title: t('watershed') }
}

/** The forecast science view: the grid, the advisory sandbox and the ENSO outlook. */
export default async function WatershedPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!isStaff(session.user.role)) redirect('/farm')
  return <Dashboard />
}
