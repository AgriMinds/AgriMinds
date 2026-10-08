'use client'

import { useQuery } from '@tanstack/react-query'
import type { HealthStatus } from '@agriminds/api-types'
import { api } from '@/lib/api/client'

export type ConnectionStatus = HealthStatus | 'offline' | 'loading'

export function useHealth() {
  const query = useQuery({
    queryKey: ['health'],
    queryFn: api.health,
    refetchInterval: 30_000,
    retry: 1,
    staleTime: 15_000,
  })
  const status: ConnectionStatus = query.isPending ? 'loading' : query.isError ? 'offline' : query.data.status
  return { ...query, status }
}
