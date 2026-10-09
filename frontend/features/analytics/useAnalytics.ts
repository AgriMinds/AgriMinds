'use client'

import { useQuery } from '@tanstack/react-query'
import { api, ApiError } from '@/lib/api/client'

export const analyticsKeys = {
  status: ['analytics', 'metabase', 'status'] as const,
  embed: ['analytics', 'metabase', 'embed'] as const,
  connection: ['analytics', 'connection'] as const,
}

/** Whether this deployment can embed a dashboard at all. Cheap, and it gates everything else. */
export function useMetabaseStatus() {
  return useQuery({
    queryKey: analyticsKeys.status,
    queryFn: api.metabaseStatus,
    staleTime: 5 * 60_000,
  })
}

/**
 * A signed viewing URL for the dashboard.
 *
 * Only fetched once the status says embedding is configured, so an unconfigured deployment
 * never provokes a 503 it already knows is coming. The URL is short-lived and the component
 * renews it on a timer rather than on an interval, so the schedule follows its own
 * `expires_at`.
 */
export function useEmbedUrl(enabled: boolean) {
  return useQuery({
    queryKey: analyticsKeys.embed,
    queryFn: api.metabaseEmbed,
    enabled,
    // A signed URL is useless once cached past its life; always ask for a fresh one.
    gcTime: 0,
    staleTime: 0,
    refetchOnWindowFocus: false,
    // 503 means not configured and 403 means not permitted: neither improves with retrying.
    retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
  })
}

/** Connection details for pointing any BI tool at the read-only schema. Administrators only. */
export function useAnalyticsConnection(enabled: boolean) {
  return useQuery({
    queryKey: analyticsKeys.connection,
    queryFn: api.analyticsConnection,
    enabled,
    staleTime: 10 * 60_000,
    retry: false,
  })
}
