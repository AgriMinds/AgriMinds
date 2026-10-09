'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'

export const predictionKeys = {
  horizon: ['drought', 'horizon'] as const,
}

/**
 * The full forecast horizon.
 *
 * Which leads carry a probability is a property of the trained model, not of the viewer, so it
 * changes only when the model is refitted — hence the long stale time.
 */
export function useHorizon() {
  return useQuery({
    queryKey: predictionKeys.horizon,
    queryFn: api.horizon,
    staleTime: 10 * 60_000,
  })
}
