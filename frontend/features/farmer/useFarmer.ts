'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { FarmCreate, FarmUpdate, LeadMonth } from '@agriminds/api-types'
import { api } from '@/lib/api/client'

export const farmerKeys = {
  dashboard: (lead: LeadMonth) => ['farmer', 'dashboard', lead] as const,
  farmAdvisory: (id: string, lead: LeadMonth) => ['farmer', 'advisory', id, lead] as const,
}

export function useFarmerDashboard(lead: LeadMonth) {
  return useQuery({
    queryKey: farmerKeys.dashboard(lead),
    queryFn: () => api.farmerDashboard(lead),
    placeholderData: (previous) => previous,
  })
}

/** Advisory for a plot the farmer picked, rather than the one the API chose for them. */
export function useFarmAdvisory(farmId: string | null, lead: LeadMonth, enabled: boolean) {
  return useQuery({
    queryKey: farmerKeys.farmAdvisory(farmId ?? 'none', lead),
    queryFn: () => api.farmAdvisory(farmId!, lead),
    enabled: enabled && Boolean(farmId),
  })
}

export function useFarmMutations(lead: LeadMonth) {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: ['farmer'] })

  return {
    create: useMutation({ mutationFn: (payload: FarmCreate) => api.createFarm(payload, lead), onSuccess: invalidate }),
    update: useMutation({
      mutationFn: ({ id, payload }: { id: string; payload: FarmUpdate }) => api.updateFarm(id, payload, lead),
      onSuccess: invalidate,
    }),
    remove: useMutation({ mutationFn: (id: string) => api.deleteFarm(id), onSuccess: invalidate }),
  }
}

/**
 * Marks an advisory as read.
 *
 * The button flips immediately, then the farmer queries are refetched so the state shown
 * is the server's, not the browser's guess. Acknowledging twice is harmless upstream.
 */
export function useAcknowledge() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (advisoryId: string) => api.acknowledgeAdvisory(advisoryId),
    onSettled: () => qc.invalidateQueries({ queryKey: ['farmer'] }),
  })
}
