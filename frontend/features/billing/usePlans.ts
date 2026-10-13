'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { PaymentConfirmation, PlanChoice } from '@agriminds/api-types'
import { api } from '@/lib/api/client'

export const planKeys = {
  plans: ['plans'] as const,
  invoices: ['plans', 'invoices'] as const,
  outstanding: ['admin', 'invoices'] as const,
  // Confirming a payment already invalidates this prefix, so settled money shows up at once.
  revenue: ['subscriptions', 'revenue'] as const,
}

export function usePlans() {
  return useQuery({ queryKey: planKeys.plans, queryFn: api.plans, staleTime: 5 * 60_000, retry: false })
}

export function useMyInvoices() {
  return useQuery({ queryKey: planKeys.invoices, queryFn: api.myInvoices, staleTime: 60_000, retry: false })
}

/** Choosing a plan changes both what you are on and what you owe. */
export function useChoosePlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (choice: PlanChoice) => api.choosePlan(choice),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: planKeys.plans })
      qc.invalidateQueries({ queryKey: planKeys.invoices })
    },
  })
}

export function useOutstandingInvoices() {
  return useQuery({
    queryKey: planKeys.outstanding,
    queryFn: api.outstandingInvoices,
    staleTime: 60_000,
  })
}

/** What the platform earns. Administrators only; everyone else is refused upstream. */
export function useRevenue() {
  return useQuery({
    queryKey: planKeys.revenue,
    queryFn: api.revenue,
    staleTime: 60_000,
    retry: false,
  })
}

/** Confirming a payment starts the subscription, so revenue is invalidated too. */
export function useConfirmPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, confirmation }: { id: string; confirmation: PaymentConfirmation }) =>
      api.confirmPayment(id, confirmation),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'invoices'] })
      qc.invalidateQueries({ queryKey: ['plans'] })
      qc.invalidateQueries({ queryKey: ['subscriptions'] })
    },
  })
}
