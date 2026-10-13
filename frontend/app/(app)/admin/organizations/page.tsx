import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { isAdmin } from '@agriminds/api-types'
import { OrganizationsPage } from '@/features/admin/OrganizationsPage'
import { getSession } from '@/lib/server/session'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('organizations')
  return { title: t('title'), description: t('intro') }
}

/** Paying accounts and their API credentials. Administrators only, like the rate card. */
export default async function OrganizationsRoute() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!isAdmin(session.user.role)) redirect('/ministry')
  return <OrganizationsPage />
}
