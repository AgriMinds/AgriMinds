import { useQuery } from '@tanstack/react-query';

import { api } from '@/services/api';
import { queryKeys } from './queryKeys';

export function useHealth(enabled = true) {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: api.health,
    enabled,
    staleTime: 30_000,
    retry: false,
    // Health is a liveness probe: never serve it from the persisted cache.
    gcTime: 0,
    meta: { persist: false },
  });
}
