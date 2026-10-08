import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { spacing, useTheme } from '@/theme';

export function KeyValue({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.value, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

export function Section({ title, body }: { title: string; body: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 2 }}>
      <Text style={[styles.sectionTitle, { color: colors.primary }]}>{title}</Text>
      <Text style={[styles.body, { color: colors.text }]}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  label: { fontSize: 13 },
  value: { fontSize: 13, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  sectionTitle: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  body: { fontSize: 14, lineHeight: 20 },
});
