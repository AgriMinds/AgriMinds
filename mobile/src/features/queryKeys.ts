export const queryKeys = {
  health: ['health'] as const,
  droughtMap: (lead: number) => ['drought', 'map', lead] as const,
  cellRisk: (params: object) => ['drought', 'cell', params] as const,
  watershed: ['drought', 'watershed'] as const,
  horizon: ['drought', 'horizon'] as const,
  advisory: (params: object) => ['advisory', params] as const,
  enso: ['enso', 'outlook'] as const,
  farmerDashboard: (lead: number) => ['farmer', 'dashboard', lead] as const,
  ministryDashboard: (lead: number) => ['ministry', 'dashboard', lead] as const,
  farms: (lead?: number) => ['farms', 'list', lead ?? null] as const,
  farm: (id: string, lead?: number) => ['farms', id, lead ?? null] as const,
  farmAdvisory: (farmId: string, lead: number) => ['farm', farmId, 'advisory', lead] as const,
  cropYieldOutlook: (year?: number, leadMonth?: number) => ['cropYield', 'outlook', year ?? null, leadMonth ?? null] as const,
  cropYieldTimeline: (throughYear?: number) => ['cropYield', 'timeline', throughYear ?? null] as const,
  ensoImpact: ['cropYield', 'ensoImpact'] as const,
  cropYieldModel: ['cropYield', 'model'] as const,
};

