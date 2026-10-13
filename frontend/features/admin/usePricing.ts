'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { PricingTierChange, StakeholderName } from '@agriminds/api-types'
import { api } from '@/lib/api/client'

export const pricingKeys = {
  catalogue: (history: boolean) => ['billing', 'pricing', history] as const,
  history: (stakeholder: StakeholderName) => ['billing', 'pricing', stakeholder] as const,
}

/** The rate card. Changes only when an administrator reprices something, so it is not polled. */
export function usePricing(includeHistory = false) {
  return useQuery({
    queryKey: pricingKeys.catalogue(includeHistory),
    queryFn: () => api.pricing(includeHistory),
    staleTime: 5 * 60_000,
  })
}

export function usePricingHistory(stakeholder: StakeholderName | null) {
  return useQuery({
    queryKey: pricingKeys.history(stakeholder ?? 'cooperative'),
    queryFn: () => api.pricingHistory(stakeholder as StakeholderName),
    enabled: stakeholder !== null,
    staleTime: 5 * 60_000,
  })
}

/** Supersede a price. Every pricing query is invalidated, including the superseded history. */
export function useReprice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ stakeholder, change }: { stakeholder: StakeholderName; change: PricingTierChange }) =>
      api.reprice(stakeholder, change),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['billing', 'pricing'] }),
  })
}
