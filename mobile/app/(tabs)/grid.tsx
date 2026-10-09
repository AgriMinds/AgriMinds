import { LEAD_MONTHS, RISK_LEVELS, riskLevelFor, type LeadMonth } from '@agriminds/api-types';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { OfflineBanner, ProvenanceBanner } from '@/components/Banners';
import { Card, Label } from '@/components/Card';
import { GridMap } from '@/components/GridMap';
import { KeyValue } from '@/components/KeyValue';
import { RiskBadge } from '@/components/RiskBadge';
import { Screen } from '@/components/Screen';
import { SegmentedControl } from '@/components/SegmentedControl';
import { EmptyState, LoadingState } from '@/components/States';
import { ThumbPad } from '@/components/ThumbPad';
import { useDroughtMap } from '@/features/useDroughtMap';
import { useI18n } from '@/i18n';
import { DEFAULT_CELL, useSelection } from '@/state/selection';
import { riskColors, spacing, useTheme } from '@/theme';

export default function GridScreen() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const sel = useSelection();
  const map = useDroughtMap(sel.lead);
  const data = map.data;
  const cell = sel.location.kind === 'cell' ? sel.location : DEFAULT_CELL;
  const [rows, cols] = data?.grid_shape ?? [8, 8];
  const p = data?.probabilities[cell.row]?.[cell.col];
  const isMinister = sel.role === 'minister';

  // Calculate severe/high risk cell metrics for minister summary
  const severeCells = data
    ? data.probabilities.flat().filter((val) => val >= 0.75).length
    : 0;

  return (
    <Screen title={t('grid.title')} subtitle={t('grid.subtitle')} refreshing={map.isFetching && !!data} onRefresh={() => map.refetch()}>
      {isMinister && data ? (
        <Card style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.primary, borderWidth: 1 }}>
          <View style={{ gap: spacing.xs }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary, textTransform: 'uppercase' }}>
              {t('ministerView.title')}
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
              <View>
                <Text style={{ fontSize: 11, color: colors.textMuted }}>{t('ministerView.droughtCoverage')}</Text>
                <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>
                  {Math.round(data.mean_probability * 100)}%
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 11, color: colors.textMuted }}>{t('ministerView.highRiskCells')}</Text>
                <Text style={{ fontSize: 20, fontWeight: '800', color: severeCells > 0 ? colors.dangerFg : colors.primary }}>
                  {severeCells} / {rows * cols}
                </Text>
              </View>
            </View>
          </View>
        </Card>
      ) : null}
      <Card>
        <Label>{t('advisory.lead')}</Label>
        <SegmentedControl<LeadMonth> options={LEAD_MONTHS.map((l) => ({ value: l, label: t(`advisory.lead${l}`) }))} value={sel.lead} onChange={sel.setLead} />
      </Card>

      {map.isError && data ? <OfflineBanner dataUpdatedAt={map.dataUpdatedAt} onRetry={() => map.refetch()} /> : null}
      {!data && map.isPending ? <LoadingState /> : null}
      {!data && map.isError ? <EmptyState error={map.error} onRetry={() => map.refetch()} /> : null}

      {data ? (
        <>
          <Card>
            <ProvenanceBanner provenance={data.provenance} />
            <GridMap map={data} selected={cell} onSelect={sel.selectCell} />
            <ThumbPad onMove={(dr, dc) => sel.moveCell(dr, dc, rows, cols)} label={t('grid.move')} />
            <View style={{ gap: spacing.xs }}>
              <KeyValue label={t('grid.issued')} value={data.issued_date} />
              <KeyValue label={t('grid.target')} value={data.target_date} />
              <KeyValue label={t('grid.mean')} value={`${Math.round(data.mean_probability * 100)}%`} />
            </View>
          </Card>
          <Card title={t('grid.selected')} subtitle={`${t('advisory.cell')} ${cell.row} / ${cell.col}`} right={p !== undefined ? <RiskBadge level={riskLevelFor(p)} probability={p} /> : undefined}>
            <Label>{t('grid.legend')}</Label>
            <View style={styles.legend}>
              {RISK_LEVELS.map((lvl) => (
                <View key={lvl} style={styles.legendItem}>
                  <View style={[styles.swatch, { backgroundColor: riskColors[lvl].bg }]} />
                  <Text style={{ color: colors.text, fontSize: 12 }}>{t(`risk.${lvl}`)}</Text>
                </View>
              ))}
            </View>
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 14, height: 14, borderRadius: 4 },
});
