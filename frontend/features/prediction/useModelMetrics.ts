'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import type { ModelMetricsResponse } from '@/lib/api/client'

export const metricsKeys = {
  all: ['drought', 'metrics'] as const,
}

/**
 * Fetch model-performance metrics from GET /api/v1/drought/metrics.
 *
 * The metrics come from the training run and change only when the model is retrained,
 * so a long stale-time is appropriate — we use the same 10-minute window as the horizon
 * hook, which also points at training-time artifacts.
 */
export function useModelMetrics() {
  return useQuery({
    queryKey: metricsKeys.all,
    queryFn: () => api.droughtMetrics() as Promise<ModelMetricsResponse>,
    staleTime: 10 * 60_000,
  })
}
