import {
  AGRO_ZONE_LOCAL_NAMES,
  AGRO_ZONES,
  CROPS,
  type AgroZone,
  type Crop,
  type CropYieldCell,
  type CropYieldScenario,
  type CropYieldScenarioRequest,
} from '@agriminds/api-types';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { OfflineBanner } from '@/components/Banners';
import { Card } from '@/components/Card';
import { KeyValue } from '@/components/KeyValue';
import { Screen } from '@/components/Screen';
import { SegmentedControl } from '@/components/SegmentedControl';
import { EmptyState, LoadingState } from '@/components/States';
import {
  useCropYieldModel,
  useCropYieldOutlook,
  useCropYieldTimeline,
  useEnsoImpact,
  useSimulateCropYield,
} from '@/features/useCropYield';
import { useI18n } from '@/i18n';
import { radius, spacing, useTheme } from '@/theme';

type YieldViewMode = 'outlook' | 'simulator' | 'timeline';
type BeltFilter = 'all' | AgroZone;

const CROP_COLORS: Record<string, string> = {
  tef: '#059669', // Emerald
  wheat: '#d97706', // Amber gold
  maize: '#2563eb', // Royal blue
};

export default function CropYieldScreen() {
  const { t } = useI18n();
  const { colors, dark } = useTheme();

  const [viewMode, setViewMode] = useState<YieldViewMode>('outlook');
  const [activeBelt, setActiveBelt] = useState<BeltFilter>('all');

  // Simulator state
  const [simCrop, setSimCrop] = useState<Crop>('tef');
  const [simZone, setSimZone] = useState<AgroZone>('Midland');
  const [simEnsoIndex, setSimEnsoIndex] = useState<number>(1.5); // El Nino default
  const [simRainDev, setSimRainDev] = useState<number>(-20); // -20% rainfall
  const [simTempDev, setSimTempDev] = useState<number>(1.0); // +1.0 C
  const [simResult, setSimResult] = useState<CropYieldScenario | null>(null);

  const outlookQuery = useCropYieldOutlook();
  const impactQuery = useEnsoImpact();
  const modelQuery = useCropYieldModel();
  const timelineQuery = useCropYieldTimeline(2030);
  const simulateMutation = useSimulateCropYield();

  const data = outlookQuery.data;
  const impact = impactQuery.data;
  const model = modelQuery.data;
  const timeline = timelineQuery.data;

  const isRefreshing =
    (outlookQuery.isFetching && !!data) ||
    (impactQuery.isFetching && !!impact) ||
    (timelineQuery.isFetching && !!timeline);

  const handleRefresh = () => {
    outlookQuery.refetch();
    impactQuery.refetch();
    modelQuery.refetch();
    timelineQuery.refetch();
  };

  const handleSimulate = async () => {
    try {
      const baselinePrecip = 120; // mean mm/month baseline
      const precip = Math.max(10, baselinePrecip * (1 + simRainDev / 100));
      const payload: CropYieldScenarioRequest = {
        crop: simCrop,
        zone: simZone,
        temperature_c: 18.5 + simTempDev,
        precipitation_mm: precip,
        enso_index: simEnsoIndex,
      };
      const res = await simulateMutation.mutateAsync(payload);
      setSimResult(res);
    } catch {
      // Error handled by mutation state
    }
  };

  const filteredCells = (data?.cells ?? []).filter((cell: CropYieldCell) =>
    activeBelt === 'all' ? true : cell.zone === activeBelt,
  );

  const selectedCandidate = model?.candidates.find((c) => c.selected);

  return (
    <Screen
      title={t('yield.title')}
      subtitle={t('yield.subtitle')}
      refreshing={isRefreshing}
      onRefresh={handleRefresh}
    >
      {/* Top Segment Mode Switcher */}
      <View style={styles.modeSwitchWrapper}>
        <SegmentedControl<YieldViewMode>
          options={[
            { value: 'outlook', label: t('yield.tabOutlook') },
            { value: 'simulator', label: t('yield.tabSimulator') },
            { value: 'timeline', label: t('yield.tabTimeline') },
          ]}
          value={viewMode}
          onChange={setViewMode}
        />
      </View>

      {/* VIEW MODE 1: OUTLOOK */}
      {viewMode === 'outlook' && (
        <>
          {outlookQuery.isError && data ? (
            <OfflineBanner
              dataUpdatedAt={outlookQuery.dataUpdatedAt}
              onRetry={handleRefresh}
            />
          ) : null}

          {!data && outlookQuery.isPending ? <LoadingState /> : null}
          {!data && outlookQuery.isError ? (
            <EmptyState error={outlookQuery.error} onRetry={handleRefresh} />
          ) : null}

          {data ? (
            <>
              {/* Top Hero Card: Conditioning and Season */}
              <View
                style={[
                  styles.heroCard,
                  {
                    backgroundColor: dark ? '#0d2217' : '#ebf7f0',
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={styles.badgeRow}>
                  <View style={[styles.pill, { backgroundColor: colors.primary }]}>
                    <Ionicons name="leaf" size={12} color="#ffffff" />
                    <Text style={styles.pillText}>
                      Season {data.year} Outlook
                    </Text>
                  </View>
                  {data.enso_index != null && (
                    <View
                      style={[
                        styles.pill,
                        { backgroundColor: dark ? '#152e3c' : '#e1f0fa' },
                      ]}
                    >
                      <Ionicons name="thermometer" size={12} color="#0284c7" />
                      <Text style={[styles.pillText, { color: '#0284c7' }]}>
                        Niño 3.4: {data.enso_index >= 0 ? '+' : ''}
                        {data.enso_index.toFixed(2)} °C ({data.enso_phase})
                      </Text>
                    </View>
                  )}
                </View>

                <Text style={[styles.heroTitle, { color: colors.text }]}>
                  {t('yield.allBelts')}
                </Text>
                <Text style={[styles.heroIntro, { color: colors.textMuted }]}>
                  {t('yield.subtitle')}
                </Text>

                {/* Agro-Ecological Belt Filter Pills */}
                <View style={styles.filterRow}>
                  <TouchableOpacity
                    onPress={() => setActiveBelt('all')}
                    style={[
                      styles.filterPill,
                      {
                        backgroundColor:
                          activeBelt === 'all'
                            ? colors.primary
                            : dark
                              ? '#1a1a1a'
                              : '#ffffff',
                        borderColor:
                          activeBelt === 'all' ? colors.primary : colors.border,
                      },
                    ]}
                    accessibilityRole="button"
                  >
                    <Text
                      style={[
                        styles.filterPillText,
                        {
                          color:
                            activeBelt === 'all'
                              ? '#ffffff'
                              : dark
                                ? colors.text
                                : '#374151',
                        },
                      ]}
                    >
                      {t('yield.allBelts')}
                    </Text>
                  </TouchableOpacity>

                  {AGRO_ZONES.map((zone) => {
                    const isSelected = activeBelt === zone;
                    const localName = AGRO_ZONE_LOCAL_NAMES[zone];
                    return (
                      <TouchableOpacity
                        key={zone}
                        onPress={() => setActiveBelt(zone)}
                        style={[
                          styles.filterPill,
                          {
                            backgroundColor: isSelected
                              ? colors.primary
                              : dark
                                ? '#1a1a1a'
                                : '#ffffff',
                            borderColor: isSelected ? colors.primary : colors.border,
                          },
                        ]}
                        accessibilityRole="button"
                      >
                        <Text
                          style={[
                            styles.filterPillText,
                            {
                              color: isSelected
                                ? '#ffffff'
                                : dark
                                  ? colors.text
                                  : '#374151',
                            },
                          ]}
                        >
                          {localName} ({zone})
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Forecasted Yield Cards by Belt and Crop */}
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  {t('yield.expectedYield')} ({t('yield.unit')})
                </Text>
              </View>

              <View style={styles.cardsGrid}>
                {filteredCells.map((cell) => {
                  const localName = cell.zone_local_name || AGRO_ZONE_LOCAL_NAMES[cell.zone];
                  const cropColor = CROP_COLORS[cell.crop] || colors.primary;
                  const maxScale = 45; // benchmark scale 45 q/ha for visualization
                  const barWidth = Math.min((cell.predicted_yield_q_ha / maxScale) * 100, 100);

                  return (
                    <View
                      key={`${cell.crop}-${cell.zone}`}
                      style={[
                        styles.yieldCard,
                        {
                          backgroundColor: colors.surface,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <View style={styles.yieldCardTop}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <View style={styles.cropBeltBadgeRow}>
                            <View
                              style={[
                                styles.zoneBadge,
                                { backgroundColor: dark ? '#1e293b' : '#f1f5f9' },
                              ]}
                            >
                              <Text style={[styles.zoneBadgeText, { color: colors.text }]}>
                                {localName} · {cell.zone}
                              </Text>
                            </View>
                          </View>
                          <Text style={[styles.cropTitle, { color: colors.text }]}>
                            {t(`crops.${cell.crop}`)}
                          </Text>
                          <Text style={[styles.altitudeRange, { color: colors.textMuted }]}>
                            ~{cell.altitude_approx_m}m
                          </Text>
                        </View>

                        <View style={styles.yieldValueBox}>
                          <Text style={[styles.yieldNumber, { color: cropColor }]}>
                            {cell.predicted_yield_q_ha.toFixed(1)}
                          </Text>
                          <Text style={[styles.yieldUnit, { color: colors.textMuted }]}>
                            {t('yield.unit')}
                          </Text>
                        </View>
                      </View>

                      {/* Visual Progress Meter */}
                      <View style={[styles.meterTrack, { backgroundColor: dark ? '#222' : '#e5e7eb' }]}>
                        <View
                          style={[
                            styles.meterFill,
                            {
                              width: `${Math.max(barWidth, 4)}%`,
                              backgroundColor: cropColor,
                            },
                          ]}
                        />
                      </View>

                      {/* Historical Delta / ENSO impact */}
                      <View style={styles.yieldCardFooter}>
                        <Text style={[styles.neutralText, { color: colors.textMuted }]}>
                          vs last record: {cell.change_vs_last_observed_pct >= 0 ? '+' : ''}
                          {cell.change_vs_last_observed_pct.toFixed(1)}%
                        </Text>
                        {cell.enso_delta_pct !== 0 && (
                          <Text
                            style={[
                              styles.diffText,
                              { color: cell.enso_delta_pct >= 0 ? '#10b981' : '#ef4444' },
                            ]}
                          >
                            {cell.enso_delta_pct >= 0 ? `+${cell.enso_delta_pct.toFixed(1)}%` : `${cell.enso_delta_pct.toFixed(1)}%`}
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>

              {/* Historical El Niño Sensitivity Section */}
              {impact && (
                <Card
                  icon={<Ionicons name="flame-outline" size={18} color="#ea580c" />}
                  title={t('yield.impactTitle')}
                  subtitle={t('yield.impactDesc')}
                >
                  <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
                    {impact.cells
                      .filter((c) => activeBelt === 'all' || c.zone === activeBelt)
                      .map((c) => {
                        const localName = AGRO_ZONE_LOCAL_NAMES[c.zone];
                        const isDrop = c.effect_pct < 0;
                        return (
                          <View
                            key={`impact-${c.crop}-${c.zone}`}
                            style={[
                              styles.impactRow,
                              {
                                backgroundColor: dark ? '#171717' : '#f8fafc',
                                borderColor: colors.border,
                              },
                            ]}
                          >
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.impactCrop, { color: colors.text }]}>
                                {t(`crops.${c.crop}`)} · {localName}
                              </Text>
                              <Text style={[styles.impactPVal, { color: colors.textMuted }]}>
                                p = {c.p_value.toFixed(3)} {c.significant ? '(p < 0.05 ★)' : ''}
                              </Text>
                            </View>

                            <View
                              style={[
                                styles.deltaPill,
                                {
                                  backgroundColor: isDrop
                                    ? dark
                                      ? '#331010'
                                      : '#fee2e2'
                                    : dark
                                      ? '#062d1d'
                                      : '#ecfdf5',
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.deltaText,
                                  { color: isDrop ? '#dc2626' : '#059669' },
                                ]}
                              >
                                {c.effect_pct >= 0 ? `+${c.effect_pct.toFixed(1)}%` : `${c.effect_pct.toFixed(1)}%`}
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                  </View>
                </Card>
              )}

              {/* Candidate Models Card */}
              {model && (
                <Card
                  icon={<Ionicons name="hardware-chip-outline" size={18} color={colors.primary} />}
                  title={t('yield.modelCard')}
                >
                  <View style={{ gap: spacing.xs }}>
                    <KeyValue label="Selected Model" value={selectedCandidate?.model ?? 'Gradient Boosted Trees'} />
                    {selectedCandidate && (
                      <>
                        <KeyValue
                          label="Holdout Score"
                          value={t('yield.rmse', { rmse: selectedCandidate.test_rmse.toFixed(2) })}
                        />
                        <KeyValue label="R² Accuracy" value={selectedCandidate.test_r2.toFixed(3)} />
                      </>
                    )}
                    <KeyValue
                      label="Historical Record"
                      value={`${model.train_years[0]} – ${model.test_years[1]} (${model.record_rows} obs)`}
                    />
                  </View>
                </Card>
              )}
            </>
          ) : null}
        </>
      )}

      {/* VIEW MODE 2: WHAT-IF SIMULATOR */}
      {viewMode === 'simulator' && (
        <View style={{ gap: spacing.md }}>
          <Card
            icon={<Ionicons name="flask-outline" size={18} color={colors.primary} />}
            title={t('yield.simTitle')}
            subtitle={t('yield.simDesc')}
          >
            {/* Crop Picker */}
            <View style={{ gap: 6 }}>
              <Text style={[styles.simFieldLabel, { color: colors.text }]}>{t('yield.simCrop')}</Text>
              <SegmentedControl<Crop>
                options={CROPS.map((c) => ({ value: c, label: t(`crops.${c}`) }))}
                value={simCrop}
                onChange={setSimCrop}
              />
            </View>

            {/* Agro-Ecological Belt */}
            <View style={{ gap: 6, marginTop: spacing.xs }}>
              <Text style={[styles.simFieldLabel, { color: colors.text }]}>{t('yield.simZone')}</Text>
              <SegmentedControl<AgroZone>
                options={AGRO_ZONES.map((z) => ({
                  value: z,
                  label: `${AGRO_ZONE_LOCAL_NAMES[z]} (${z})`,
                }))}
                value={simZone}
                onChange={setSimZone}
              />
            </View>

            {/* Pacific ENSO Condition */}
            <View style={{ gap: 6, marginTop: spacing.xs }}>
              <Text style={[styles.simFieldLabel, { color: colors.text }]}>{t('yield.simEnso')}</Text>
              <SegmentedControl<number>
                options={[
                  { value: 1.8, label: 'El Niño (+1.8°C)' },
                  { value: 0.0, label: 'Neutral (0.0°C)' },
                  { value: -1.3, label: 'La Niña (-1.3°C)' },
                ]}
                value={simEnsoIndex}
                onChange={setSimEnsoIndex}
              />
            </View>

            {/* Rainfall Deviation */}
            <View style={{ gap: 6, marginTop: spacing.xs }}>
              <Text style={[styles.simFieldLabel, { color: colors.text }]}>{t('yield.simRain')}</Text>
              <SegmentedControl<number>
                options={[
                  { value: -30, label: '-30% Drought' },
                  { value: -15, label: '-15% Deficit' },
                  { value: 0, label: 'Normal' },
                  { value: 20, label: '+20% Surplus' },
                ]}
                value={simRainDev}
                onChange={setSimRainDev}
              />
            </View>

            {/* Temperature Anomaly */}
            <View style={{ gap: 6, marginTop: spacing.xs }}>
              <Text style={[styles.simFieldLabel, { color: colors.text }]}>{t('yield.simTemp')}</Text>
              <SegmentedControl<number>
                options={[
                  { value: -0.5, label: '-0.5°C Cooler' },
                  { value: 0.5, label: '+0.5°C Mild' },
                  { value: 1.5, label: '+1.5°C Warm' },
                  { value: 2.5, label: '+2.5°C Hot' },
                ]}
                value={simTempDev}
                onChange={setSimTempDev}
              />
            </View>

            {/* Run Button */}
            <TouchableOpacity
              onPress={handleSimulate}
              disabled={simulateMutation.isPending}
              style={[
                styles.simActionBtn,
                { backgroundColor: colors.primary, marginTop: spacing.sm },
              ]}
              accessibilityRole="button"
            >
              {simulateMutation.isPending ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="calculator-outline" size={17} color="#ffffff" />
                  <Text style={styles.simActionBtnText}>{t('yield.simRun')}</Text>
                </>
              )}
            </TouchableOpacity>
          </Card>

          {/* Simulation Output Card */}
          {simResult && (
            <Card
              icon={<Ionicons name="sparkles-outline" size={18} color="#10b981" />}
              title={t('yield.simResult')}
              subtitle={`${t(`crops.${simResult.cell.crop}`)} · ${simResult.cell.zone_local_name} (${simResult.cell.zone})`}
            >
              <View style={styles.simResultHeader}>
                <View>
                  <Text style={[styles.simBigNumber, { color: CROP_COLORS[simResult.cell.crop] || colors.primary }]}>
                    {simResult.cell.predicted_yield_q_ha.toFixed(1)}{' '}
                    <Text style={{ fontSize: 16, color: colors.textMuted }}>{t('yield.unit')}</Text>
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                    {t('yield.simNeutral')}: {simResult.cell.neutral_yield_q_ha.toFixed(1)} {t('yield.unit')}
                  </Text>
                </View>

                <View
                  style={[
                    styles.deltaPillLarge,
                    {
                      backgroundColor:
                        simResult.cell.enso_delta_pct >= 0
                          ? dark
                            ? '#062d1d'
                            : '#ecfdf5'
                          : dark
                            ? '#331010'
                            : '#fee2e2',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.deltaTextLarge,
                      {
                        color: simResult.cell.enso_delta_pct >= 0 ? '#059669' : '#dc2626',
                      },
                    ]}
                  >
                    {simResult.cell.enso_delta_pct >= 0 ? '+' : ''}
                    {simResult.cell.enso_delta_pct.toFixed(1)}%
                  </Text>
                </View>
              </View>

              <View style={{ gap: spacing.xs, marginTop: spacing.sm }}>
                <KeyValue label="Altitude Zone" value={`~${simResult.cell.altitude_approx_m}m above sea level`} />
                <KeyValue label="Temperature Input" value={`${simResult.cell.inputs.temperature_c.toFixed(1)} °C`} />
                <KeyValue label="Precipitation Input" value={`${Math.round(simResult.cell.inputs.precipitation_mm)} mm/month`} />
                <KeyValue label="Niño 3.4 Setting" value={`${simResult.cell.inputs.enso_index.toFixed(2)} °C (${simResult.cell.inputs.enso_phase})`} />
                <KeyValue label="Holdout RMSE" value={`${simResult.provenance.test_rmse_q_ha.toFixed(2)} q/ha`} />
              </View>
            </Card>
          )}
        </View>
      )}

      {/* VIEW MODE 3: MULTI-YEAR TIMELINE */}
      {viewMode === 'timeline' && (
        <View style={{ gap: spacing.md }}>
          <Card
            icon={<Ionicons name="time-outline" size={18} color={colors.primary} />}
            title={t('yield.timelineTitle')}
            subtitle={t('yield.timelineDesc')}
          >
            {timelineQuery.isPending && !timeline ? <LoadingState /> : null}
            {timelineQuery.isError && !timeline ? (
              <EmptyState error={timelineQuery.error} onRetry={() => timelineQuery.refetch()} />
            ) : null}

            {timeline ? (
              <View style={{ gap: spacing.md, marginTop: spacing.xs }}>
                {/* Scenario Legend */}
                <View style={styles.timelineLegend}>
                  <View style={styles.legendDotWrap}>
                    <View style={[styles.timelineDot, { backgroundColor: '#059669' }]} />
                    <Text style={{ fontSize: 11, color: colors.text }}>Observed History</Text>
                  </View>
                  <View style={styles.legendDotWrap}>
                    <View style={[styles.timelineDot, { backgroundColor: '#ea580c' }]} />
                    <Text style={{ fontSize: 11, color: colors.text }}>El Niño (+1.5°C)</Text>
                  </View>
                  <View style={styles.legendDotWrap}>
                    <View style={[styles.timelineDot, { backgroundColor: '#2563eb' }]} />
                    <Text style={{ fontSize: 11, color: colors.text }}>Neutral Path</Text>
                  </View>
                </View>

                {/* Recent Observed Seasons Table */}
                <Text style={[styles.timelineSectionTitle, { color: colors.text }]}>
                  Recent Observed Harvests (Choke Basin Mean)
                </Text>
                <View style={[styles.tableWrap, { borderColor: colors.border }]}>
                  <View style={[styles.tableHeader, { backgroundColor: colors.surfaceAlt }]}>
                    <Text style={[styles.thCell, { color: colors.text }]}>Year</Text>
                    <Text style={[styles.thCell, { color: colors.text }]}>Tef (q/ha)</Text>
                    <Text style={[styles.thCell, { color: colors.text }]}>Wheat</Text>
                    <Text style={[styles.thCell, { color: colors.text }]}>Maize</Text>
                  </View>
                  {timeline.observed.slice(-5).map((row) => (
                    <View key={row.year} style={[styles.tableRow, { borderColor: colors.border }]}>
                      <Text style={[styles.tdCellBold, { color: colors.text }]}>{row.year}</Text>
                      <Text style={[styles.tdCell, { color: colors.text }]}>
                        {row.tef_q_ha != null ? row.tef_q_ha.toFixed(1) : '—'}
                      </Text>
                      <Text style={[styles.tdCell, { color: colors.text }]}>
                        {row.wheat_q_ha != null ? row.wheat_q_ha.toFixed(1) : '—'}
                      </Text>
                      <Text style={[styles.tdCell, { color: colors.text }]}>
                        {row.maize_q_ha != null ? row.maize_q_ha.toFixed(1) : '—'}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Projected Scenarios through 2030 */}
                <Text style={[styles.timelineSectionTitle, { color: colors.text, marginTop: spacing.sm }]}>
                  Machine Learning Projections (to {timeline.through_year})
                </Text>
                {timeline.scenarios.map((scenario) => {
                  const lastYear = scenario.years[scenario.years.length - 1];
                  return (
                    <View
                      key={scenario.key}
                      style={[
                        styles.scenarioCard,
                        {
                          backgroundColor: dark ? '#131f17' : '#f8fafc',
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <View style={styles.scenarioCardHeader}>
                        <Text style={[styles.scenarioName, { color: colors.primary }]}>
                          {scenario.label}
                        </Text>
                        <Text style={{ fontSize: 11, color: colors.textMuted }}>
                          Final Season {lastYear?.year ?? 2030}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                        <Text style={{ fontSize: 12, color: colors.text }}>
                          Tef: {lastYear?.tef_q_ha != null ? lastYear.tef_q_ha.toFixed(1) : '—'} q/ha
                        </Text>
                        <Text style={{ fontSize: 12, color: colors.text }}>
                          Wheat: {lastYear?.wheat_q_ha != null ? lastYear.wheat_q_ha.toFixed(1) : '—'} q/ha
                        </Text>
                        <Text style={{ fontSize: 12, color: colors.text }}>
                          Maize: {lastYear?.maize_q_ha != null ? lastYear.maize_q_ha.toFixed(1) : '—'} q/ha
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : null}
          </Card>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  modeSwitchWrapper: {
    marginBottom: spacing.xs,
  },
  heroCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  pillText: { fontSize: 11, fontWeight: '700', color: '#ffffff' },
  heroTitle: { fontSize: 22, fontWeight: '800', marginTop: 4, letterSpacing: -0.4 },
  heroIntro: { fontSize: 13, lineHeight: 18 },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: spacing.xs,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  sectionHeader: {
    marginTop: spacing.sm,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  cardsGrid: {
    gap: spacing.md,
  },
  yieldCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  yieldCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cropBeltBadgeRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  zoneBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  zoneBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cropTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  altitudeRange: {
    fontSize: 11,
    marginTop: 2,
  },
  yieldValueBox: {
    alignItems: 'flex-end',
  },
  yieldNumber: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  yieldUnit: {
    fontSize: 11,
    fontWeight: '600',
  },
  meterTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    width: '100%',
  },
  meterFill: {
    height: '100%',
    borderRadius: 3,
  },
  yieldCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 2,
  },
  neutralText: {
    fontSize: 11,
  },
  diffText: {
    fontSize: 11,
    fontWeight: '700',
  },
  impactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
  },
  impactCrop: {
    fontSize: 13,
    fontWeight: '700',
  },
  impactPVal: {
    fontSize: 11,
    marginTop: 2,
  },
  deltaPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  deltaText: {
    fontSize: 12,
    fontWeight: '800',
  },
  simFieldLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  simActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: radius.md,
  },
  simActionBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  simResultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: spacing.xs,
  },
  simBigNumber: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  deltaPillLarge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  deltaTextLarge: {
    fontSize: 16,
    fontWeight: '800',
  },
  timelineLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    paddingBottom: spacing.xs,
  },
  legendDotWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  timelineSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  tableWrap: {
    borderWidth: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderTopWidth: 1,
  },
  thCell: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
  },
  tdCell: {
    flex: 1,
    fontSize: 12,
  },
  tdCellBold: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
  },
  scenarioCard: {
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 4,
  },
  scenarioCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scenarioName: {
    fontSize: 13,
    fontWeight: '700',
  },
});
