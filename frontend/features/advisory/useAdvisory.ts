'use client'

import { useQuery } from '@tanstack/react-query'
import type { AdvisoryRequest } from '@agriminds/api-types'
import { api } from '@/lib/api/client'

export function useAdvisory(
  req: Required<Pick<AdvisoryRequest, 'crop' | 'lead_month' | 'row' | 'col'>> &
    Pick<AdvisoryRequest, 'iek_agrees'>,
) {
  return useQuery({
    queryKey: ['advisory', req.crop, req.lead_month, req.row, req.col, req.iek_agrees ?? null],
    queryFn: () => api.evaluateAdvisory(req),
    placeholderData: (previous) => previous,
  })
}
