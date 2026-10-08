'use client'

import { useQuery } from '@tanstack/react-query'
import type { LeadMonth } from '@agriminds/api-types'
import { api } from '@/lib/api/client'

export const droughtMapKey = (leadMonth: LeadMonth) => ['drought', 'map', leadMonth] as const

export function useDroughtMap(leadMonth: LeadMonth) {
  return useQuery({
    queryKey: droughtMapKey(leadMonth),
    queryFn: () => api.droughtMap(leadMonth),
    placeholderData: (previous) => previous, // keep the grid visible while the lead changes
  })
}
