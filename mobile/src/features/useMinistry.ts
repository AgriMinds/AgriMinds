import type { LeadMonth, MinistryDashboard } from '@agriminds/api-types';
import { useQuery } from '@tanstack/react-query';

import { api } from '@/services/api';
import { useSelection } from '@/state/selection';
import { queryKeys } from './queryKeys';

export function useMinistryDashboard(leadMonth?: LeadMonth) {
  const selLead = useSelection((s) => s.lead);
  const role = useSelection((s) => s.role);
  const lead = leadMonth ?? selLead;

  return useQuery<MinistryDashboard>({
    queryKey: queryKeys.ministryDashboard(lead),
    queryFn: () => api.ministryDashboard(lead, role === 'da' ? 'da' : 'minister'),
  });
}
