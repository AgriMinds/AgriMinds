'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'

export const dataSourcesKey = ['system', 'data-sources'] as const

/** What the forecast is actually built from. Changes only when a deployment is reconfigured. */
export function useDataSources() {
  return useQuery({
    queryKey: dataSourcesKey,
    queryFn: api.dataSources,
    staleTime: 5 * 60_000,
  })
}
