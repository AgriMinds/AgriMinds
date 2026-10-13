import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { isAdmin } from '@agriminds/api-types'
import { PricingPage } from '@/features/admin/PricingPage'
import { getSession } from '@/lib/server/session'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('pricing')
  return { title: t('title'), description: t('intro') }
}

/**
 * The commercial rate card — administrators only.
 *
 * A stricter gate than the science pages: those are staff-wide, because a development agent needs
 * the forecast to do their job. What the platform charges a ministry is not their business, so a
 * minister or an agent is sent back to their dashboard rather than shown a read-only version.
 */
export default async function PricingRoute() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!isAdmin(session.user.role)) redirect('/ministry')
  return <PricingPage />
}
