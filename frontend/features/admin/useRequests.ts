'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { RequestDecision } from '@agriminds/api-types'
import { api } from '@/lib/api/client'

export const requestKeys = {
  inbox: (openOnly: boolean) => ['access-requests', 'inbox', openOnly] as const,
}

export function useAccessRequests(openOnly = false) {
  return useQuery({
    queryKey: requestKeys.inbox(openOnly),
    queryFn: () => api.accessRequests(openOnly),
    staleTime: 60_000,
  })
}

/** Approving creates the account, so the organisations list is invalidated too. */
export function useDecideRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: RequestDecision }) =>
      api.decideRequest(id, decision),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['access-requests'] })
      qc.invalidateQueries({ queryKey: ['organizations'] })
    },
  })
}
