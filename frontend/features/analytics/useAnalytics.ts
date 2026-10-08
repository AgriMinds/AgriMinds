'use client'

import { useQuery } from '@tanstack/react-query'
import { api, ApiError } from '@/lib/api/client'

export const analyticsKeys = {
  status: ['analytics', 'powerbi', 'status'] as const,
  embed: ['analytics', 'powerbi', 'embed'] as const,
  connection: ['analytics', 'connection'] as const,
}

/** Whether this deployment can embed a report at all. Cheap, and it gates everything else. */
export function usePowerBiStatus() {
  return useQuery({
    queryKey: analyticsKeys.status,
    queryFn: api.powerbiStatus,
    staleTime: 5 * 60_000,
  })
}

/**
 * A viewing token for the report.
 *
 * Only fetched once the status says embedding is configured, so an unconfigured deployment
 * never provokes a 503 it already knows is coming. Tokens are short-lived and the component
 * refreshes them on a timer rather than on an interval, so the schedule follows the token's
 * own `expires_at`.
 */
export function useEmbedToken(enabled: boolean) {
  return useQuery({
    queryKey: analyticsKeys.embed,
    queryFn: api.powerbiEmbedToken,
    enabled,
    // A token is useless once cached past its life; always ask for a fresh one.
    gcTime: 0,
    staleTime: 0,
    refetchOnWindowFocus: false,
    // 503 means not configured and 403 means not permitted: neither improves with retrying.
    retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
  })
}

/** Connection details for building a report in Power BI Desktop. Administrators only. */
export function useAnalyticsConnection(enabled: boolean) {
  return useQuery({
    queryKey: analyticsKeys.connection,
    queryFn: api.analyticsConnection,
    enabled,
    staleTime: 10 * 60_000,
    retry: false,
  })
}
