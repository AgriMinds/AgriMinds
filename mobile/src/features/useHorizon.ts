import type { HorizonResponse } from '@agriminds/api-types';
import { useQuery } from '@tanstack/react-query';

import { api } from '@/services/api';
import { queryKeys } from './queryKeys';

export function useHorizon() {
  return useQuery<HorizonResponse>({
    queryKey: queryKeys.horizon,
    queryFn: () => api.horizon(),
  });
}
