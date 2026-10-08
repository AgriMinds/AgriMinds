import { useQuery } from '@tanstack/react-query';

import { api } from '@/services/api';
import { queryKeys } from './queryKeys';

export function useEnsoOutlook() {
  return useQuery({ queryKey: queryKeys.enso, queryFn: api.ensoOutlook, staleTime: 60 * 60 * 1000 });
}
