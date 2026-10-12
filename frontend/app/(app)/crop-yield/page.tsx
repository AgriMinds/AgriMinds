import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { isStaff } from '@agriminds/api-types'
import { CropYieldPage } from '@/features/crop-yield/CropYieldPage'
import { getSession } from '@/lib/server/session'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('cropYield')
  return {
    title: t('title'),
    description:
      'Expected yield for tef, wheat and maize across the Kolla, Woina Dega and Dega belts, ' +
      'conditioned on Niño 3.4, with the model’s holdout scores and stated limits.',
  }
}

/**
 * Crop planning view — staff only, same gate as the other science pages.
 *
 * A farmer is sent to /farm: these are belt-wide averages from a 34-year spreadsheet, and the
 * climate term moves them by a couple of percent, so there is nothing here a smallholder could
 * act on that their own advisory does not already say better.
 */
export default async function CropYieldRoute() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!isStaff(session.user.role)) redirect('/farm')
  return <CropYieldPage />
}
