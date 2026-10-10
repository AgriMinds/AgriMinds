import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { radius, spacing, useTheme } from '@/theme';

interface StatProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  tone?: 'danger' | 'primary' | 'warning';
  loading?: boolean;
}

export function Stat({ icon, label, value, detail, tone }: StatProps) {
  const { colors, dark } = useTheme();

  const isDanger = tone === 'danger';
  const iconBg = isDanger
    ? dark
      ? '#3b120c'
      : '#fee2e2'
    : dark
      ? '#13281b'
      : '#e6f7ec';

  const valueColor = isDanger ? (dark ? '#f87171' : '#dc2626') : colors.text;
  const borderColor = isDanger ? (dark ? '#7f1d1d' : '#fca5a5') : colors.border;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor,
        },
      ]}
    >
      <View style={styles.topRow}>
        <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
          {icon}
        </View>
        <Text style={[styles.label, { color: colors.textMuted }]} numberOfLines={1}>
          {label}
        </Text>
      </View>

      <Text style={[styles.value, { color: valueColor }]}>{value}</Text>

      {detail ? (
        <Text style={[styles.detail, { color: colors.textMuted }]}>{detail}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 140,
    borderRadius: 18,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 2,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  value: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  detail: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
});
