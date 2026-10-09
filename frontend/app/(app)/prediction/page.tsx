import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { isStaff } from '@agriminds/api-types'
import { PredictionHorizon } from '@/features/prediction/PredictionHorizon'
import { getSession } from '@/lib/server/session'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('nav')
  return { title: t('prediction') }
}

/** The forecast horizon: what the model will commit to, and for how long. Staff only. */
export default async function PredictionPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!isStaff(session.user.role)) redirect('/farm')
  return <PredictionHorizon locale={await getLocale()} />
}
