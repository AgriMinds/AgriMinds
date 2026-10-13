import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { PlansPage } from '@/features/billing/PlansPage'
import { getSession } from '@/lib/server/session'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('plans')
  return { title: t('title'), description: t('intro') }
}

/**
 * The customer's own billing page: what their organisation is on, what else is offered, and what
 * they owe. Any signed-in person may open it — the API answers for their organisation and refuses
 * when they belong to none, which is a better message than a redirect to a page they did not ask
 * for.
 */
export default async function BillingRoute() {
  const session = await getSession()
  if (!session) redirect('/login')
  return <PlansPage />
}
