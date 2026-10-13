import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { AdminBillingPage } from '@/features/billing/AdminBillingPage'
import { PlansPage } from '@/features/billing/PlansPage'
import { getSession } from '@/lib/server/session'

export async function generateMetadata(): Promise<Metadata> {
  // The route serves two different pages, so the tab should not claim it is always the customer's.
  const session = await getSession()
  const t = await getTranslations(session?.user.role === 'admin' ? 'revenue' : 'plans')
  return { title: t('title'), description: t('intro') }
}

/**
 * Billing, from whichever side the person is on.
 *
 * A customer sees what their organisation is on, what else is offered and what they owe. An
 * administrator has no organisation of their own, so the customer's page can only refuse them --
 * they get the platform's side instead: what has been earned, what is waiting to be confirmed,
 * and what is about to renew or has lapsed.
 */
export default async function BillingRoute() {
  const session = await getSession()
  if (!session) redirect('/login')
  return session.user.role === 'admin' ? <AdminBillingPage /> : <PlansPage />
}
