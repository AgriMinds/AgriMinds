'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'

export const watershedKey = ['drought', 'watershed'] as const

/**
 * The surveyed catchment outline.
 *
 * A survey boundary does not change between requests, so it is fetched once and kept. A
 * deployment with no boundary answers 404; the shared query client does not retry 4xx, and
 * callers treat the absence as "draw the plain grid" rather than as a failure.
 */
export function useWatershed() {
  return useQuery({
    queryKey: watershedKey,
    queryFn: api.watershed,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}
