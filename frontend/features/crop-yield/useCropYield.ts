'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'

export const cropYieldKeys = {
  outlook: (year?: number, leadMonth?: number) => ['crop-yield', 'outlook', year ?? null, leadMonth ?? null] as const,
  model: ['crop-yield', 'model'] as const,
  impact: ['crop-yield', 'enso-impact'] as const,
}

/**
 * Predicted yield for every crop and altitude belt.
 *
 * The artifact changes only when the model is retrained, and the ENSO value it is conditioned on
 * only when a new month is ingested, so this is cached for as long as the other training-time
 * queries (10 minutes) rather than treated as live data.
 */
export function useCropYieldOutlook(params?: { year?: number; leadMonth?: number }) {
  return useQuery({
    queryKey: cropYieldKeys.outlook(params?.year, params?.leadMonth),
    queryFn: () => api.cropYieldOutlook(params),
    staleTime: 10 * 60_000,
  })
}

/** What El Niño years did to each crop and belt. Changes only with a retrain. */
export function useEnsoImpact() {
  return useQuery({
    queryKey: cropYieldKeys.impact,
    queryFn: api.ensoImpact,
    staleTime: 60 * 60_000,
  })
}

/** Candidate scores, feature importance and the model's stated limits. */
export function useCropYieldModel() {
  return useQuery({
    queryKey: cropYieldKeys.model,
    queryFn: api.cropYieldModel,
    staleTime: 60 * 60_000,
  })
}
