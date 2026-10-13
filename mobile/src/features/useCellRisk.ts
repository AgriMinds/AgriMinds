import type { CellRiskQuery, CellRiskResponse } from '@agriminds/api-types';
import { useQuery } from '@tanstack/react-query';

import { api } from '@/services/api';
import { queryKeys } from './queryKeys';

export function useCellRisk(params: CellRiskQuery | null, enabled: boolean = true) {
  return useQuery<CellRiskResponse>({
    queryKey: queryKeys.cellRisk(params ?? {}),
    queryFn: () => api.cellRisk(params!),
    enabled: Boolean(params && enabled),
  });
}
