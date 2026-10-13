import type {
  CropYieldModelCard,
  CropYieldOutlook,
  CropYieldScenario,
  CropYieldScenarioRequest,
  CropYieldTimeline,
  EnsoImpactResponse,
} from '@agriminds/api-types';
import { useMutation, useQuery } from '@tanstack/react-query';

import { api } from '@/services/api';
import { queryKeys } from './queryKeys';

export function useCropYieldOutlook(params?: { year?: number; leadMonth?: number }) {
  return useQuery<CropYieldOutlook>({
    queryKey: queryKeys.cropYieldOutlook(params?.year, params?.leadMonth),
    queryFn: () => api.cropYieldOutlook(params),
    staleTime: 10 * 60_000,
  });
}

export function useEnsoImpact() {
  return useQuery<EnsoImpactResponse>({
    queryKey: queryKeys.ensoImpact,
    queryFn: api.ensoImpact,
    staleTime: 60 * 60_000,
  });
}

export function useCropYieldModel() {
  return useQuery<CropYieldModelCard>({
    queryKey: queryKeys.cropYieldModel,
    queryFn: api.cropYieldModel,
    staleTime: 60 * 60_000,
  });
}

export function useCropYieldTimeline(throughYear: number = 2030) {
  return useQuery<CropYieldTimeline>({
    queryKey: queryKeys.cropYieldTimeline(throughYear),
    queryFn: () => api.cropYieldTimeline(throughYear),
    staleTime: 60 * 60_000,
  });
}

export function useSimulateCropYield() {
  return useMutation<CropYieldScenario, Error, CropYieldScenarioRequest>({
    mutationFn: (payload: CropYieldScenarioRequest) => api.simulateCropYield(payload),
  });
}

