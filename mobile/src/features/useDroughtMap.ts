import { useQuery } from '@tanstack/react-query';

import { api } from '@/services/api';
import { queryKeys } from './queryKeys';

export function useDroughtMap(lead: number) {
  return useQuery({
    queryKey: queryKeys.droughtMap(lead),
    queryFn: () => api.droughtMap(lead),
  });
}
