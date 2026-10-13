import type { WatershedBoundary } from '@agriminds/api-types';
import { useQuery } from '@tanstack/react-query';

import { api } from '@/services/api';
import { queryKeys } from './queryKeys';

export function useWatershed() {
  return useQuery<WatershedBoundary>({
    queryKey: queryKeys.watershed,
    queryFn: () => api.watershed(),
    staleTime: 1000 * 60 * 60 * 24, // Catchment geometry is static for a deployment
  });
}
