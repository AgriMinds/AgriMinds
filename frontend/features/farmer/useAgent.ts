'use client'

import { useMutation } from '@tanstack/react-query'
import type { AgentQuestion } from '@agriminds/api-types'
import { api } from '@/lib/api/client'

/**
 * Asking the agent is a mutation, not a query: the same question asked again should be answered
 * again against the current forecast rather than served from a cache the farmer cannot see.
 */
export function useAskAgent() {
  return useMutation({ mutationFn: (q: AgentQuestion) => api.ask(q) })
}
