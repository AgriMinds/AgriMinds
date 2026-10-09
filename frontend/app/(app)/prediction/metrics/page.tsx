import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { isStaff } from '@agriminds/api-types'
import { ModelMetricsPage } from '@/features/prediction/ModelMetricsPage'
import { getSession } from '@/lib/server/session'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('nav')
  return {
    title: `Model Performance · ${t('prediction')}`,
    description:
      'CNN-LSTM drought and ENSO model evaluation metrics — RMSE, MAE, AUC, BSS vs persistence and ridge baselines.',
  }
}

/**
 * Model performance metrics page — staff only.
 *
 * Shows measured skill (RMSE, MAE, correlation, AUC, BSS) for the CNN-LSTM drought and ENSO
 * models versus persistence and ridge baselines on held-out data.  Same role gate as the parent
 * /prediction page: a farmer is redirected to /farm.
 */
export default async function PredictionMetricsPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!isStaff(session.user.role)) redirect('/farm')
  return <ModelMetricsPage />
}
