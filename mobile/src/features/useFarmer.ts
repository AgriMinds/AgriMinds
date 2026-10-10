import type { FarmAdvisory, FarmerDashboard, LeadMonth } from '@agriminds/api-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/services/api';
import { useSelection } from '@/state/selection';
import { queryKeys } from './queryKeys';

export function useFarmerDashboard(leadMonth?: LeadMonth) {
  const selLead = useSelection((s) => s.lead);
  const role = useSelection((s) => s.role);
  const lead = leadMonth ?? selLead;

  return useQuery<FarmerDashboard>({
    queryKey: queryKeys.farmerDashboard(lead),
    queryFn: () => api.farmerDashboard(lead, role === 'da' ? 'da' : 'farmer'),
  });
}

export function useFarmAdvisory(farmId: string | null, leadMonth?: LeadMonth, enabled: boolean = true) {
  const selLead = useSelection((s) => s.lead);
  const role = useSelection((s) => s.role);
  const lead = leadMonth ?? selLead;

  return useQuery<FarmAdvisory>({
    queryKey: farmId ? queryKeys.farmAdvisory(farmId, lead) : ['farm', 'none'],
    queryFn: () => api.farmAdvisory(farmId!, lead, role === 'da' ? 'da' : 'farmer'),
    enabled: Boolean(farmId) && enabled,
  });
}

export function useAcknowledgeAdvisory() {
  const queryClient = useQueryClient();
  const role = useSelection((s) => s.role);

  return useMutation({
    mutationFn: (advisoryId: string) =>
      api.acknowledgeAdvisory(advisoryId, role === 'da' ? 'da' : 'farmer'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['farmer', 'dashboard'] });
    },
  });
}
