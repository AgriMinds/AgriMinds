import { useColorScheme } from 'react-native';
import type { RiskLevel } from '@agriminds/api-types';

export const brand = {
  forest: '#173f36',
  forestDeep: '#0f2b25',
  lime: '#d6e85f',
  sage: '#b7d4b5',
  clay: '#c98957',
} as const;

export const riskColors: Record<RiskLevel, { bg: string; fg: string }> = {
  Low: { bg: '#059669', fg: '#ffffff' },
  Moderate: { bg: '#f59e0b', fg: '#1c1917' },
  High: { bg: '#f97316', fg: '#ffffff' },
  Severe: { bg: '#dc2626', fg: '#ffffff' },
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;
export const type = {
  title: { fontSize: 22, fontWeight: '800' as const },
  heading: { fontSize: 17, fontWeight: '700' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  caption: { fontSize: 12, fontWeight: '500' as const },
  label: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1, textTransform: 'uppercase' as const },
};

export interface Palette {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  onPrimary: string;
  accent: string;
  onAccent: string;
  warningBg: string;
  warningFg: string;
  dangerBg: string;
  dangerFg: string;
  infoBg: string;
  infoFg: string;
}

export const lightPalette: Palette = {
  background: '#f7f8f4',
  surface: '#ffffff',
  surfaceAlt: '#eef1ea',
  border: '#dde3d8',
  text: '#172033',
  textMuted: '#5b6670',
  primary: brand.forest,
  onPrimary: '#ffffff',
  accent: brand.lime,
  onAccent: brand.forest,
  warningBg: '#fef3c7',
  warningFg: '#92400e',
  dangerBg: '#fee2e2',
  dangerFg: '#991b1b',
  infoBg: '#dbeafe',
  infoFg: '#1e3a8a',
};

export const darkPalette: Palette = {
  background: '#183129',
  surface: '#21483b',
  surfaceAlt: '#1b3a30',
  border: '#2f5a4b',
  text: '#edf7ef',
  textMuted: '#a9c4b4',
  primary: brand.lime,
  onPrimary: brand.forest,
  accent: brand.lime,
  onAccent: brand.forest,
  warningBg: '#4a3a0f',
  warningFg: '#fde68a',
  dangerBg: '#4c1d1d',
  dangerFg: '#fecaca',
  infoBg: '#1e3a5f',
  infoFg: '#bfdbfe',
};

export function useTheme(): { colors: Palette; dark: boolean } {
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  return { colors: dark ? darkPalette : lightPalette, dark };
}
