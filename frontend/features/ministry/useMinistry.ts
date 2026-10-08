'use client'

import { useQuery } from '@tanstack/react-query'
import type { LeadMonth } from '@agriminds/api-types'
import { api } from '@/lib/api/client'

export function useMinistryDashboard(lead: LeadMonth) {
  return useQuery({
    queryKey: ['ministry', 'dashboard', lead],
    queryFn: () => api.ministryDashboard(lead),
    placeholderData: (previous) => previous,
  })
}

/** Woreda names arrive in all three languages; show the one the person is reading. */
export function localeName(
  row: { name_en: string; name_am: string; name_om: string },
  locale: string,
): string {
  if (locale === 'am') return row.name_am
  if (locale === 'or') return row.name_om
  return row.name_en
}
