'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { OrganizationCreate } from '@agriminds/api-types'
import { api } from '@/lib/api/client'

export const orgKeys = {
  all: ['organizations'] as const,
  keys: (id: string) => ['organizations', id, 'keys'] as const,
  usage: (id: string) => ['organizations', id, 'usage'] as const,
}

export function useOrganizations() {
  return useQuery({ queryKey: orgKeys.all, queryFn: api.organizations, staleTime: 60_000 })
}

export function useOrganizationKeys(id: string | null) {
  return useQuery({
    queryKey: orgKeys.keys(id ?? ''),
    queryFn: () => api.organizationKeys(id as string),
    enabled: id !== null,
    staleTime: 60_000,
  })
}

/** Usage moves with every billed call, so this is the one query here worth refetching. */
export function useOrganizationUsage(id: string | null) {
  return useQuery({
    queryKey: orgKeys.usage(id ?? ''),
    queryFn: () => api.organizationUsage(id as string),
    enabled: id !== null,
    staleTime: 30_000,
  })
}

export function useCreateOrganization() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: OrganizationCreate) => api.createOrganization(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: orgKeys.all }),
  })
}

export function useIssueKey(organizationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (label: string) => api.issueKey(organizationId, label),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orgKeys.keys(organizationId) })
      qc.invalidateQueries({ queryKey: orgKeys.all })
    },
  })
}

export function useRevokeKey(organizationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (keyId: string) => api.revokeKey(organizationId, keyId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orgKeys.keys(organizationId) })
      qc.invalidateQueries({ queryKey: orgKeys.all })
    },
  })
}
