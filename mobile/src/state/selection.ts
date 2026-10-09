import type { Crop, LeadMonth } from '@agriminds/api-types';
import { create } from 'zustand';

export type UserRole = 'farmer' | 'minister' | 'da';

export type Location =
  | { kind: 'cell'; row: number; col: number }
  | { kind: 'gps'; latitude: number; longitude: number };

interface SelectionState {
  role: UserRole;
  isSidebarOpen: boolean;
  crop: Crop;
  lead: LeadMonth;
  iekAgrees: boolean | null;
  location: Location;
  setRole: (role: UserRole) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setCrop: (crop: Crop) => void;
  setLead: (lead: LeadMonth) => void;
  setIek: (value: boolean | null) => void;
  selectCell: (row: number, col: number) => void;
  moveCell: (dRow: number, dCol: number, rows: number, cols: number) => void;
  useGps: (latitude: number, longitude: number) => void;
}

export const DEFAULT_CELL = { row: 4, col: 4 };

export const useSelection = create<SelectionState>((set) => ({
  role: 'farmer',
  isSidebarOpen: false,
  crop: 'tef',
  lead: 1,
  iekAgrees: null,
  location: { kind: 'cell', ...DEFAULT_CELL },
  setRole: (role) => set({ role }),
  setSidebarOpen: (isSidebarOpen) => set({ isSidebarOpen }),
  toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),
  setCrop: (crop) => set({ crop }),
  setLead: (lead) => set({ lead }),
  setIek: (iekAgrees) => set({ iekAgrees }),
  selectCell: (row, col) => set({ location: { kind: 'cell', row, col } }),
  moveCell: (dRow, dCol, rows, cols) =>
    set((s) => {
      const base = s.location.kind === 'cell' ? s.location : DEFAULT_CELL;
      return {
        location: {
          kind: 'cell',
          row: Math.min(Math.max(0, base.row + dRow), rows - 1),
          col: Math.min(Math.max(0, base.col + dCol), cols - 1),
        },
      };
    }),
  useGps: (latitude, longitude) => set({ location: { kind: 'gps', latitude, longitude } }),
}));
