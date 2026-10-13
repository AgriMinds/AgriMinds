import { LEAD_MONTHS, RISK_LEVELS, riskLevelFor, type LeadMonth } from '@agriminds/api-types';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { OfflineBanner, ProvenanceBanner } from '@/components/Banners';
import { Card, Label } from '@/components/Card';
import { GridMap } from '@/components/GridMap';
import { KeyValue } from '@/components/KeyValue';
import { PlotModal } from '@/components/PlotModal';
import { RiskBadge } from '@/components/RiskBadge';
import { Screen } from '@/components/Screen';
import { SegmentedControl } from '@/components/SegmentedControl';
import { EmptyState, LoadingState } from '@/components/States';
import { ThumbPad } from '@/components/ThumbPad';
import { useCellRisk } from '@/features/useCellRisk';
import { useDroughtMap } from '@/features/useDroughtMap';
import { useWatershed } from '@/features/useWatershed';
import { useI18n } from '@/i18n';
import { DEFAULT_CELL, useSelection } from '@/state/selection';
import { radius, riskColors, spacing, useTheme } from '@/theme';

export default function GridScreen() {
  const { t } = useI18n();
  const { colors, dark } = useTheme();
  const router = useRouter();
  const sel = useSelection();

  const [plotModalVisible, setPlotModalVisible] = useState(false);

  const mapQuery = useDroughtMap(sel.lead);
  const watershedQuery = useWatershed();

  const data = mapQuery.data;
  const watershed = watershedQuery.data;
  const cell = sel.location.kind === 'cell' ? sel.location : DEFAULT_CELL;
  const [rows, cols] = data?.grid_shape ?? [8, 8];
  const p = data?.probabilities[cell.row]?.[cell.col];
  const isMinister = sel.role === 'minister';

  // Deep query for selected cell diagnostics
  const cellQuery = useCellRisk({
    lead_month: sel.lead,
    row: cell.row,
    col: cell.col,
  });
  const cellDetail = cellQuery.data;

  // Severe cells count for executive summary
  const severeCells = data
    ? data.probabilities.flat().filter((val) => val >= 0.75).length
    : 0;

  const handleRefresh = () => {
    mapQuery.refetch();
    watershedQuery.refetch();
    cellQuery.refetch();
  };

  const isRefreshing =
    (mapQuery.isFetching && !!data) ||
    (watershedQuery.isFetching && !!watershed);

  const selectedLat = cellDetail?.latitude ?? data?.cells.find((c) => c.row === cell.row && c.col === cell.col)?.latitude;
  const selectedLon = cellDetail?.longitude ?? data?.cells.find((c) => c.row === cell.row && c.col === cell.col)?.longitude;
  const isInWatershed = cellDetail?.in_watershed ?? (watershed?.grid?.inside?.[cell.row]?.[cell.col] ?? true);

  return (
    <Screen
      title={t('grid.title')}
      subtitle={t('grid.subtitle')}
      refreshing={isRefreshing}
      onRefresh={handleRefresh}
    >
      {/* Executive Minister / DA Macro Card */}
      {isMinister && data ? (
        <Card style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.primary, borderWidth: 1 }}>
          <View style={{ gap: spacing.xs }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="shield-checkmark" size={14} color={colors.primary} />
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary, textTransform: 'uppercase' }}>
                {t('ministerView.title')}
              </Text>
            </View>
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

      {/* Forecast Lead Time Selector */}
      <Card>
        <Label>{t('advisory.lead')}</Label>
        <SegmentedControl<LeadMonth>
          options={LEAD_MONTHS.map((l) => ({ value: l, label: t(`advisory.lead${l}`) }))}
          value={sel.lead}
          onChange={sel.setLead}
        />
      </Card>

      {/* Observed Soil & Palmer Moisture Conditions (Catchment Telemetry) */}
      {data?.conditions && (
        <View
          style={[
            styles.conditionsCard,
            {
              backgroundColor: dark ? '#111b15' : '#f0fdf4',
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.conditionsHeader}>
            <View style={styles.conditionsPill}>
              <Ionicons name="water" size={13} color={colors.primary} />
              <Text style={[styles.conditionsPillText, { color: colors.primary }]}>
                Observed Ground Condition · {data.conditions.as_of}
              </Text>
            </View>
            <Text style={[styles.conditionsStatus, { color: colors.text }]}>
              {data.conditions.category} ({data.conditions.mean >= 0 ? '+' : ''}{data.conditions.mean.toFixed(2)})
            </Text>
          </View>
          <Text style={[styles.conditionsNote, { color: colors.textMuted }]}>
            {data.conditions.cells_in_drought} of {rows * cols} cells in meteorological drought band. Driest sector: {data.conditions.driest_category}.
          </Text>
        </View>
      )}

      {mapQuery.isError && data ? (
        <OfflineBanner dataUpdatedAt={mapQuery.dataUpdatedAt} onRetry={handleRefresh} />
      ) : null}
      {!data && mapQuery.isPending ? <LoadingState /> : null}
      {!data && mapQuery.isError ? (
        <EmptyState error={mapQuery.error} onRetry={handleRefresh} />
      ) : null}

      {data ? (
        <>
          {/* Spatial Grid Map & Navigation */}
          <Card>
            <ProvenanceBanner provenance={data.provenance} />
            <GridMap
              map={data}
              selected={cell}
              onSelect={sel.selectCell}
              insideMask={watershed?.grid?.inside}
            />
            <ThumbPad
              onMove={(dr, dc) => sel.moveCell(dr, dc, rows, cols)}
              label={t('grid.move')}
            />
            <View style={{ gap: spacing.xs, marginTop: spacing.xs }}>
              <KeyValue label={t('grid.issued')} value={data.issued_date} />
              <KeyValue label={t('grid.target')} value={data.target_date} />
              <KeyValue label={t('grid.mean')} value={`${Math.round(data.mean_probability * 100)}%`} />
              {watershed?.area_km2 ? (
                <KeyValue label="Catchment Area" value={`${Math.round(watershed.area_km2).toLocaleString()} km²`} />
              ) : null}
            </View>
          </Card>

          {/* Deep Cell Diagnostic & Action Card */}
          <Card
            title={t('grid.selected')}
            subtitle={`${t('advisory.cell')} [${cell.row}, ${cell.col}]`}
            right={p !== undefined ? <RiskBadge level={riskLevelFor(p)} probability={p} /> : undefined}
          >
            <View style={{ gap: spacing.xs, marginVertical: spacing.xs }}>
              {selectedLat != null && selectedLon != null && (
                <KeyValue
                  label="Center GPS"
                  value={`${selectedLat.toFixed(3)}°N, ${selectedLon.toFixed(3)}°E`}
                />
              )}
              <KeyValue
                label="Catchment Status"
                value={isInWatershed ? 'Inside Choke Watershed' : 'Outer Buffer Zone'}
              />
              {cellDetail?.pdsi != null && (
                <KeyValue
                  label="Observed Palmer Sc-PDSI"
                  value={`${cellDetail.pdsi.toFixed(2)} (${cellDetail.pdsi_category ?? 'Normal'})`}
                />
              )}
            </View>

            {/* Quick Actions for Selected Cell */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                onPress={() => {
                  sel.selectCell(cell.row, cell.col);
                  router.push('/(tabs)' as any);
                }}
                style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                accessibilityRole="button"
              >
                <Ionicons name="leaf" size={14} color="#ffffff" />
                <Text style={styles.actionBtnText}>Get Advisory</Text>
              </TouchableOpacity>

              {selectedLat != null && selectedLon != null && (
                <TouchableOpacity
                  onPress={() => setPlotModalVisible(true)}
                  style={[styles.actionBtnSecondary, { borderColor: colors.primary }]}
                  accessibilityRole="button"
                >
                  <Ionicons name="add-circle-outline" size={14} color={colors.primary} />
                  <Text style={[styles.actionBtnSecondaryText, { color: colors.primary }]}>
                    Add Plot Here
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={{ marginTop: spacing.md }}>
              <Label>{t('grid.legend')}</Label>
            </View>
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

      {/* Plot Modal pre-filled with selected cell coordinates */}
      {selectedLat != null && selectedLon != null && (
        <PlotModal
          visible={plotModalVisible}
          farm={null}
          lead={sel.lead}
          initialCoords={{ latitude: selectedLat, longitude: selectedLon }}
          onClose={() => setPlotModalVisible(false)}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  conditionsCard: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.xs,
  },
  conditionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  conditionsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  conditionsPillText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  conditionsStatus: {
    fontSize: 12,
    fontWeight: '700',
  },
  conditionsNote: {
    fontSize: 12,
    lineHeight: 16,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.md,
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  actionBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  actionBtnSecondaryText: {
    fontSize: 13,
    fontWeight: '700',
  },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 14, height: 14, borderRadius: 4 },
});
