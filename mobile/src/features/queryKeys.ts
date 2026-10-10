export const queryKeys = {
  health: ['health'] as const,
  droughtMap: (lead: number) => ['drought', 'map', lead] as const,
  advisory: (params: object) => ['advisory', params] as const,
  enso: ['enso', 'outlook'] as const,
  farmerDashboard: (lead: number) => ['farmer', 'dashboard', lead] as const,
  ministryDashboard: (lead: number) => ['ministry', 'dashboard', lead] as const,
  farmAdvisory: (farmId: string, lead: number) => ['farm', farmId, 'advisory', lead] as const,
  watershed: ['watershed'] as const,
};
