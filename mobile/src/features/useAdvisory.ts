import type { AdvisoryRequest } from '@agriminds/api-types';
import { useQuery } from '@tanstack/react-query';

import { api } from '@/services/api';
import type { Location } from '@/state/selection';
import { useSelection } from '@/state/selection';
import { queryKeys } from './queryKeys';

function toRequest(crop: AdvisoryRequest['crop'], lead: number, iek: boolean | null, loc: Location): AdvisoryRequest {
  const base: AdvisoryRequest = { crop, lead_month: lead, iek_agrees: iek };
  return loc.kind === 'cell'
    ? { ...base, row: loc.row, col: loc.col }
    : { ...base, latitude: loc.latitude, longitude: loc.longitude };
}

export function useAdvisory() {
  const { crop, lead, iekAgrees, location } = useSelection();
  const payload = toRequest(crop, lead, iekAgrees, location);
  return useQuery({
    queryKey: queryKeys.advisory(payload),
    queryFn: () => api.evaluateAdvisory(payload),
  });
}
