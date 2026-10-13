import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { isAdmin } from '@agriminds/api-types'
import { RequestsInbox } from '@/features/admin/RequestsInbox'
import { getSession } from '@/lib/server/session'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('requests')
  return { title: t('title'), description: t('intro') }
}

/** The inbox of people asking to buy. Administrators only, like the rest of the commercial side. */
export default async function RequestsRoute() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!isAdmin(session.user.role)) redirect('/ministry')
  return <RequestsInbox />
}
