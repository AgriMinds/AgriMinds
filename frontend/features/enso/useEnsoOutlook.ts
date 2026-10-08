'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'

export function useEnsoOutlook() {
  return useQuery({ queryKey: ['enso', 'outlook'], queryFn: api.ensoOutlook, staleTime: 5 * 60_000 })
}
