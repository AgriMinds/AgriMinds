import type { RiskLevel } from '@agriminds/api-types';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useI18n } from '@/i18n';
import { radius, riskColors } from '@/theme';

export function RiskBadge({ level, probability, large }: { level: RiskLevel; probability?: number; large?: boolean }) {
  const { t } = useI18n();
  const c = riskColors[level];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }, large && styles.large]} accessibilityLabel={`${t(`risk.${level}`)} risk`}>
      <Text style={[styles.text, { color: c.fg }, large && styles.textLarge]}>
        {t(`risk.${level}`)}
        {probability !== undefined ? ` · ${Math.round(probability * 100)}%` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  large: { paddingHorizontal: 16, paddingVertical: 8 },
  text: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  textLarge: { fontSize: 16 },
});
