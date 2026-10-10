import { useColorScheme } from 'react-native';
import type { RiskLevel } from '@agriminds/api-types';
import type { UserRole } from '@/state/selection';

// ─── Brand Palette ───────────────────────────────────────────────────────────
export const brand = {
  // Core greens — Ethiopian highlands
  forest: '#0e3d30',
  forestDeep: '#082519',
  forestMid: '#1a5c45',
  forestLight: '#2d7a5a',
  lime: '#c8e04a',
  limeDark: '#a3b832',
  sage: '#b7d4b5',
  // Ethiopian flag accent tones
  gold: '#f5a623',
  goldDark: '#c4841a',
  amber: '#f59e0b',
  // Alert spectrum
  clay: '#c98957',
  rust: '#b94d2a',
  // Neutral
  ink: '#0d1f1a',
  fog: '#f0f4ef',
} as const;

// ─── Role Accent Colours ─────────────────────────────────────────────────────
/** Each role gets a distinct accent so its UI chrome is instantly recognisable */
export const roleAccents: Record<UserRole, { primary: string; light: string; onPrimary: string; gradient: [string, string] }> = {
  farmer: {
    primary: '#1a7a4e',
    light: '#e0f5eb',
    onPrimary: '#ffffff',
    gradient: ['#1a7a4e', '#0e3d30'],
  },
  minister: {
    primary: '#1a4a8a',
    light: '#e3ebf9',
    onPrimary: '#ffffff',
    gradient: ['#1a4a8a', '#0e2d5c'],
  },
  da: {
    primary: '#7c3a00',
    light: '#fef0e0',
    onPrimary: '#ffffff',
    gradient: ['#b86200', '#7c3a00'],
  },
};

// ─── Risk Colours ─────────────────────────────────────────────────────────────
export const riskColors: Record<RiskLevel, { bg: string; fg: string; border: string }> = {
  Low:      { bg: '#059669', fg: '#ffffff', border: '#047857' },
  Moderate: { bg: '#f59e0b', fg: '#1c1917', border: '#d97706' },
  High:     { bg: '#f97316', fg: '#ffffff', border: '#ea580c' },
  Severe:   { bg: '#dc2626', fg: '#ffffff', border: '#b91c1c' },
};

// ─── Spacing & Radius ─────────────────────────────────────────────────────────
export const spacing = {
  xxs: 2,
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   24,
  xxl:  32,
  pill: 999,
} as const;

// ─── Shadows ──────────────────────────────────────────────────────────────────
export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  card: {
    shadowColor: '#0e3d30',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
} as const;

// ─── Typography ───────────────────────────────────────────────────────────────
export const type = {
  hero:    { fontSize: 28, fontWeight: '900' as const, letterSpacing: -0.5 },
  title:   { fontSize: 22, fontWeight: '800' as const, letterSpacing: -0.3 },
  heading: { fontSize: 17, fontWeight: '700' as const },
  subhead: { fontSize: 15, fontWeight: '600' as const },
  body:    { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  bodyMd:  { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: '500' as const },
  label: {
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  },
  micro:   { fontSize: 10, fontWeight: '600' as const, letterSpacing: 0.5 },
};

// ─── Palette Interface ────────────────────────────────────────────────────────
export interface Palette {
  background: string;
  backgroundAlt: string;
  surface: string;
  surfaceAlt: string;
  surfaceElevated: string;
  border: string;
  borderStrong: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  primaryLight: string;
  onPrimary: string;
  accent: string;
  onAccent: string;
  // semantic
  successBg: string;
  successFg: string;
  warningBg: string;
  warningFg: string;
  dangerBg: string;
  dangerFg: string;
  infoBg: string;
  infoFg: string;
  // role strips
  roleFarmerBg: string;
  roleFarmerFg: string;
  roleMinisterBg: string;
  roleMinisterFg: string;
  roleDaBg: string;
  roleDaFg: string;
  // chart
  chartLine: string;
  chartBar: string;
  chartBarMuted: string;
}

export const lightPalette: Palette = {
  background: '#f4f7f2',
  backgroundAlt: '#edf1ea',
  surface: '#ffffff',
  surfaceAlt: '#eef2eb',
  surfaceElevated: '#f9fbf8',
  border: '#dde5d8',
  borderStrong: '#bfcfbb',
  text: '#0d1f1a',
  textSecondary: '#2e4a3d',
  textMuted: '#5a6e63',
  primary: brand.forest,
  primaryLight: '#e1f0e8',
  onPrimary: '#ffffff',
  accent: brand.lime,
  onAccent: brand.forest,
  successBg: '#d1fae5',
  successFg: '#065f46',
  warningBg: '#fef3c7',
  warningFg: '#92400e',
  dangerBg: '#fee2e2',
  dangerFg: '#991b1b',
  infoBg: '#dbeafe',
  infoFg: '#1e3a8a',
  roleFarmerBg: '#e0f5eb',
  roleFarmerFg: '#1a7a4e',
  roleMinisterBg: '#e3ebf9',
  roleMinisterFg: '#1a4a8a',
  roleDaBg: '#fef0e0',
  roleDaFg: '#7c3a00',
  chartLine: brand.forestLight,
  chartBar: brand.lime,
  chartBarMuted: brand.sage,
};

export const darkPalette: Palette = {
  background: '#0d2219',
  backgroundAlt: '#102a20',
  surface: '#163325',
  surfaceAlt: '#1c3d2c',
  surfaceElevated: '#1f4530',
  border: '#2a5040',
  borderStrong: '#3a6650',
  text: '#ecf7ef',
  textSecondary: '#b8d8c5',
  textMuted: '#7aa98e',
  primary: brand.lime,
  primaryLight: '#253a0d',
  onPrimary: brand.forestDeep,
  accent: brand.limeDark,
  onAccent: brand.forestDeep,
  successBg: '#064e3b',
  successFg: '#6ee7b7',
  warningBg: '#451a03',
  warningFg: '#fde68a',
  dangerBg: '#450a0a',
  dangerFg: '#fecaca',
  infoBg: '#1e3a5f',
  infoFg: '#bfdbfe',
  roleFarmerBg: '#0a2e1c',
  roleFarmerFg: '#6ee7b7',
  roleMinisterBg: '#0e1e40',
  roleMinisterFg: '#93c5fd',
  roleDaBg: '#2d1500',
  roleDaFg: '#fbbf24',
  chartLine: brand.lime,
  chartBar: brand.forestLight,
  chartBarMuted: '#2a5040',
};

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useTheme(): { colors: Palette; dark: boolean } {
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  return { colors: dark ? darkPalette : lightPalette, dark };
}

/** Returns the accent colours for the currently active role */
export function useRoleTheme(role: UserRole) {
  return roleAccents[role];
}
