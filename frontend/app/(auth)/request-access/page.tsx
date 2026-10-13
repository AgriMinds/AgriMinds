import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { RequestAccessForm } from '@/features/admin/RequestAccessForm'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('requestAccess')
  return { title: t('title'), description: t('intro') }
}

/**
 * The public front door — no session required.
 *
 * A cooperative, woreda office, insurer, ministry, NGO or university can say they want the
 * platform without first having an account created for them by somebody who already knew they
 * existed. It sits beside /login because that is where somebody without access ends up.
 */
export default function RequestAccessRoute() {
  return <RequestAccessForm />
}
