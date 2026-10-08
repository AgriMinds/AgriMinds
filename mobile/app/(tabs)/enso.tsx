import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { OfflineBanner, ProvenanceBanner } from '@/components/Banners';
import { Card, Label } from '@/components/Card';
import { KeyValue } from '@/components/KeyValue';
import { Screen } from '@/components/Screen';
import { EmptyState, LoadingState } from '@/components/States';
import { useEnsoOutlook } from '@/features/useEnsoOutlook';
import { useI18n } from '@/i18n';
import { radius, spacing, useTheme } from '@/theme';

function Bars({ points, color, muted }: { points: { date: string; nino34: number }[]; color: string; muted: string }) {
  const max = Math.max(1.5, ...points.map((p) => Math.abs(p.nino34)));
  return (
    <View style={styles.bars}>
      {points.map((p) => {
        const h = (Math.abs(p.nino34) / max) * 48;
        const up = p.nino34 >= 0;
        return (
          <View key={p.date} style={styles.barCol} accessibilityLabel={`${p.date}: ${p.nino34.toFixed(2)}`}>
            <View style={[styles.barTrack, { justifyContent: up ? 'flex-end' : 'flex-start' }]}>
              <View style={[styles.bar, { height: Math.max(2, h), backgroundColor: color, opacity: up ? 1 : 0.55 }]} />
            </View>
            <Text style={[styles.barLabel, { color: muted }]} numberOfLines={1}>
              {p.date.slice(2)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export default function EnsoScreen() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const q = useEnsoOutlook();
  const data = q.data;
  return (
    <Screen title={t('enso.title')} refreshing={q.isFetching && !!data} onRefresh={() => q.refetch()}>
      {q.isError && data ? <OfflineBanner dataUpdatedAt={q.dataUpdatedAt} onRetry={() => q.refetch()} /> : null}
      {!data && q.isPending ? <LoadingState /> : null}
      {!data && q.isError ? <EmptyState error={q.error} onRetry={() => q.refetch()} /> : null}
      {data ? (
        <>
          <Card>
            <ProvenanceBanner provenance={data.provenance} />
            <View style={{ gap: spacing.xs }}>
              <KeyValue label={t('enso.current')} value={`${data.current_nino34 >= 0 ? '+' : ''}${data.current_nino34.toFixed(2)} °C`} />
              <KeyValue label={t('enso.state')} value={data.current_state} />
            </View>
          </Card>
          <Card title={t('enso.forecast')}>
            {data.forecast_series.length ? (
              <Bars points={data.forecast_series} color={colors.accent} muted={colors.textMuted} />
            ) : (
              <Text style={{ color: colors.textMuted }}>{t('enso.noForecast')}</Text>
            )}
          </Card>
          <Card title={t('enso.history')}>
            <Bars points={data.historical_series.slice(-12)} color={colors.primary} muted={colors.textMuted} />
          </Card>
          <Card>
            <Label>{t('enso.impact')}</Label>
            <Text style={{ color: colors.text, lineHeight: 20 }}>{data.teleconnection_summary}</Text>
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  bars: { flexDirection: 'row', gap: 4, alignItems: 'flex-end' },
  barCol: { flex: 1, alignItems: 'center', gap: 2 },
  barTrack: { height: 52, width: '100%' },
  bar: { width: '100%', borderRadius: radius.sm },
  barLabel: { fontSize: 9 },
});
