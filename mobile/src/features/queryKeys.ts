export const queryKeys = {
  health: ['health'] as const,
  droughtMap: (lead: number) => ['drought', 'map', lead] as const,
  advisory: (params: object) => ['advisory', params] as const,
  enso: ['enso', 'outlook'] as const,
};
