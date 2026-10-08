import type { ForecastProvenance } from '@agriminds/api-types';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useI18n } from '@/i18n';
import { radius, spacing, useTheme } from '@/theme';
import { relativeTime } from '@/utils/time';

function useRelative(ts: number): string {
  const { t } = useI18n();
  const r = relativeTime(ts);
  switch (r.unit) {
    case 'now':
      return t('common.justNow');
    case 'minutes':
      return t('common.minutesAgo', { n: r.n });
    case 'hours':
      return t('common.hoursAgo', { n: r.n });
    case 'days':
      return t('common.daysAgo', { n: r.n });
  }
}

/** Shown when a query failed but cached data from an earlier successful call is on screen. */
export function OfflineBanner({ dataUpdatedAt, onRetry }: { dataUpdatedAt: number; onRetry?: () => void }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const rel = useRelative(dataUpdatedAt);
  return (
    <View style={[styles.banner, { backgroundColor: colors.warningBg }]} accessibilityRole="alert">
      <Ionicons name="cloud-offline-outline" size={18} color={colors.warningFg} />
      <Text style={[styles.text, { color: colors.warningFg }]}>
        {t('common.offline')} · {t('common.lastUpdated', { time: rel })}
      </Text>
      {onRetry ? (
        <Pressable onPress={onRetry} hitSlop={8} accessibilityRole="button">
          <Text style={[styles.action, { color: colors.warningFg }]}>{t('common.retry')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Shown whenever the forecast is not live output from a model trained on real data. */
export function ProvenanceBanner({ provenance }: { provenance: ForecastProvenance }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const synthetic = provenance.data_source !== 'real';
  const precomputed = provenance.source !== 'model';
  if (!synthetic && !precomputed) {
    return (
      <Text style={[styles.meta, { color: colors.textMuted }]}>
        {t('provenance.model', { version: provenance.model_version, issued: provenance.issued_date })}
      </Text>
    );
  }
  return (
    <View style={[styles.banner, { backgroundColor: synthetic ? colors.dangerBg : colors.infoBg }]} accessibilityRole="alert">
      <Ionicons name="warning-outline" size={18} color={synthetic ? colors.dangerFg : colors.infoFg} />
      <Text style={[styles.text, { color: synthetic ? colors.dangerFg : colors.infoFg }]}>
        {synthetic ? t('provenance.synthetic') : t('provenance.precomputed')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md },
  text: { flex: 1, fontSize: 13, fontWeight: '600' },
  action: { fontSize: 13, fontWeight: '800', textDecorationLine: 'underline' },
  meta: { fontSize: 11 },
});
