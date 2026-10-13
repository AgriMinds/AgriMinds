import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { OfflineBanner, ProvenanceBanner } from '@/components/Banners';
import { Card, Label } from '@/components/Card';
import { KeyValue } from '@/components/KeyValue';
import { Screen } from '@/components/Screen';
import { SegmentedControl } from '@/components/SegmentedControl';
import { EmptyState, LoadingState } from '@/components/States';
import { useEnsoOutlook } from '@/features/useEnsoOutlook';
import { useHorizon } from '@/features/useHorizon';
import { useI18n } from '@/i18n';
import { radius, spacing, useTheme } from '@/theme';

type EnsoTabMode = 'overview' | 'horizon';

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
              <View
                style={[
                  styles.bar,
                  {
                    height: Math.max(2, h),
                    backgroundColor: up ? '#ea580c' : '#0284c7',
                    opacity: 0.9,
                  },
                ]}
              />
            </View>
            <Text style={[styles.barLabel, { color: muted }]} numberOfLines={1}>
              {p.date.slice(2)}
            </Text>
            <Text style={{ fontSize: 8, color: up ? '#ea580c' : '#0284c7', fontWeight: '700' }}>
              {p.nino34 >= 0 ? '+' : ''}{p.nino34.toFixed(1)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export default function EnsoScreen() {
  const { t } = useI18n();
  const { colors, dark } = useTheme();
  const [tabMode, setTabMode] = useState<EnsoTabMode>('overview');

  const ensoQuery = useEnsoOutlook();
  const horizonQuery = useHorizon();

  const data = ensoQuery.data;
  const horizon = horizonQuery.data;

  const isRefreshing =
    (ensoQuery.isFetching && !!data) ||
    (horizonQuery.isFetching && !!horizon);

  const handleRefresh = () => {
    ensoQuery.refetch();
    horizonQuery.refetch();
  };

  const isElNino = (data?.current_nino34 ?? 0) >= 0.5;
  const isLaNina = (data?.current_nino34 ?? 0) <= -0.5;

  return (
    <Screen
      title={t('enso.title')}
      refreshing={isRefreshing}
      onRefresh={handleRefresh}
    >
      {/* Top Segment Mode Switcher */}
      <View style={styles.modeSwitchWrapper}>
        <SegmentedControl<EnsoTabMode>
          options={[
            { value: 'overview', label: t('enso.tabOverview') },
            { value: 'horizon', label: t('enso.tabHorizon') },
          ]}
          value={tabMode}
          onChange={setTabMode}
        />
      </View>

      {/* MODE 1: CLIMATE OVERVIEW & TRACK */}
      {tabMode === 'overview' && (
        <>
          {ensoQuery.isError && data ? (
            <OfflineBanner dataUpdatedAt={ensoQuery.dataUpdatedAt} onRetry={handleRefresh} />
          ) : null}
          {!data && ensoQuery.isPending ? <LoadingState /> : null}
          {!data && ensoQuery.isError ? (
            <EmptyState error={ensoQuery.error} onRetry={handleRefresh} />
          ) : null}

          {data ? (
            <>
              {/* Oceanic Anomaly Hero Card */}
              <View
                style={[
                  styles.heroCard,
                  {
                    backgroundColor: isElNino
                      ? dark
                        ? '#2a140a'
                        : '#fff7ed'
                      : isLaNina
                        ? dark
                          ? '#0b1d2e'
                          : '#eff6ff'
                        : dark
                          ? '#0d2217'
                          : '#f0fdf4',
                    borderColor: isElNino ? '#ea580c' : isLaNina ? '#0284c7' : colors.primary,
                  },
                ]}
              >
                <View style={styles.heroBadgeRow}>
                  <View
                    style={[
                      styles.heroPill,
                      {
                        backgroundColor: isElNino ? '#ea580c' : isLaNina ? '#0284c7' : colors.primary,
                      },
                    ]}
                  >
                    <Ionicons name="thermometer" size={13} color="#ffffff" />
                    <Text style={styles.heroPillText}>Niño 3.4 SST Index</Text>
                  </View>
                  <View
                    style={[
                      styles.heroPill,
                      {
                        backgroundColor: dark ? '#1e293b' : '#ffffff',
                        borderWidth: 1,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.heroPillText,
                        { color: isElNino ? '#ea580c' : isLaNina ? '#0284c7' : colors.primary },
                      ]}
                    >
                      {data.current_category ?? data.current_state}
                    </Text>
                  </View>
                </View>

                <View style={styles.heroValueWrap}>
                  <Text
                    style={[
                      styles.heroBigTemp,
                      { color: isElNino ? '#ea580c' : isLaNina ? '#0284c7' : colors.primary },
                    ]}
                  >
                    {data.current_nino34 >= 0 ? '+' : ''}
                    {data.current_nino34.toFixed(2)} °C
                  </Text>
                  <Text style={[styles.heroSub, { color: colors.textMuted }]}>
                    Sea Surface Temperature Departure
                  </Text>
                </View>

                <ProvenanceBanner provenance={data.provenance} />
              </View>

              {/* 6-Month Forward Forecast Track */}
              <Card
                icon={<Ionicons name="trending-up" size={18} color="#0284c7" />}
                title={t('enso.forecast')}
                subtitle="Deep CNN-LSTM neural projection across equatorial Pacific"
              >
                {data.forecast_series.length ? (
                  <Bars points={data.forecast_series} color={colors.accent} muted={colors.textMuted} />
                ) : (
                  <Text style={{ color: colors.textMuted }}>{t('enso.noForecast')}</Text>
                )}
              </Card>

              {/* 12-Month Recent History */}
              <Card
                icon={<Ionicons name="calendar-outline" size={18} color={colors.primary} />}
                title={t('enso.history')}
                subtitle="Last observed 12 months in the Niño 3.4 Pacific region"
              >
                <Bars points={data.historical_series.slice(-12)} color={colors.primary} muted={colors.textMuted} />
              </Card>

              {/* Teleconnections on Ethiopian Agriculture */}
              <Card
                icon={<Ionicons name="globe-outline" size={18} color={colors.primary} />}
                title={t('enso.impact')}
              >
                <Text style={{ color: colors.text, lineHeight: 22, fontSize: 13 }}>
                  {data.teleconnection_summary}
                </Text>
              </Card>
            </>
          ) : null}
        </>
      )}

      {/* MODE 2: FORECAST HORIZON & MODEL SKILL */}
      {tabMode === 'horizon' && (
        <View style={{ gap: spacing.md }}>
          {horizonQuery.isError && horizon ? (
            <OfflineBanner dataUpdatedAt={horizonQuery.dataUpdatedAt} onRetry={handleRefresh} />
          ) : null}
          {!horizon && horizonQuery.isPending ? <LoadingState /> : null}
          {!horizon && horizonQuery.isError ? (
            <EmptyState error={horizonQuery.error} onRetry={handleRefresh} />
          ) : null}

          {horizon ? (
            <>
              <Card
                icon={<Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />}
                title={t('enso.horizonTitle')}
                subtitle={t('enso.horizonDesc')}
              >
                <View style={{ gap: spacing.md, marginTop: spacing.xs }}>
                  {horizon.leads.map((lead) => {
                    const isCommitted = lead.kind === 'forecast';
                    return (
                      <View
                        key={lead.lead_month}
                        style={[
                          styles.leadCard,
                          {
                            backgroundColor: dark ? '#111b15' : '#f8fafc',
                            borderColor: isCommitted ? colors.primary : colors.border,
                          },
                        ]}
                      >
                        <View style={styles.leadHeader}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <View
                              style={[
                                styles.leadMonthBadge,
                                { backgroundColor: isCommitted ? colors.primary : '#64748b' },
                              ]}
                            >
                              <Text style={styles.leadMonthBadgeText}>L{lead.lead_month}</Text>
                            </View>
                            <Text style={[styles.leadTitle, { color: colors.text }]}>
                              {lead.lead_month}-Month Horizon ({lead.target_month.slice(0, 7)})
                            </Text>
                          </View>

                          <View
                            style={[
                              styles.kindPill,
                              {
                                backgroundColor: isCommitted
                                  ? dark
                                    ? '#062d1d'
                                    : '#ecfdf5'
                                  : dark
                                    ? '#1e293b'
                                    : '#f1f5f9',
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.kindPillText,
                                { color: isCommitted ? '#059669' : '#64748b' },
                              ]}
                            >
                              {isCommitted ? 'Operational Forecast' : 'Advisory Outlook'}
                            </Text>
                          </View>
                        </View>

                        {/* Skill Verification Scorecard */}
                        <View style={[styles.skillBox, { borderColor: colors.border }]}>
                          <View style={styles.skillItem}>
                            <Text style={[styles.skillLabel, { color: colors.textMuted }]}>ROC-AUC</Text>
                            <Text style={[styles.skillVal, { color: colors.text }]}>
                              {lead.skill.auc != null ? lead.skill.auc.toFixed(3) : 'N/A'}
                            </Text>
                          </View>
                          <View style={styles.skillItem}>
                            <Text style={[styles.skillLabel, { color: colors.textMuted }]}>Brier Skill</Text>
                            <Text style={[styles.skillVal, { color: colors.text }]}>
                              {lead.skill.bss_vs_climatology != null
                                ? `${lead.skill.bss_vs_climatology >= 0 ? '+' : ''}${lead.skill.bss_vs_climatology.toFixed(3)}`
                                : 'N/A'}
                            </Text>
                          </View>
                          <View style={styles.skillItem}>
                            <Text style={[styles.skillLabel, { color: colors.textMuted }]}>Verification</Text>
                            <Text
                              style={[
                                styles.skillVal,
                                {
                                  color:
                                    lead.skill.bss_vs_climatology && lead.skill.bss_vs_climatology > 0
                                      ? '#10b981'
                                      : colors.textMuted,
                                },
                              ]}
                            >
                              {lead.skill.bss_vs_climatology && lead.skill.bss_vs_climatology > 0
                                ? '✓ Beats Climo'
                                : 'Baseline'}
                            </Text>
                          </View>
                        </View>

                        {lead.probability != null && (
                          <Text style={{ fontSize: 12, color: colors.text, marginTop: 4 }}>
                            Basin mean drought likelihood: <Text style={{ fontWeight: '800' }}>{Math.round(lead.probability * 100)}%</Text>
                          </Text>
                        )}
                        {lead.basis && (
                          <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2, lineHeight: 16 }}>
                            {lead.basis}
                          </Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              </Card>

              {/* Citations & Rigorous Methodology */}
              <Card title="Model Rigour & Audit">
                <Text style={{ fontSize: 11, color: colors.textMuted, lineHeight: 16 }}>
                  {horizon.note}
                </Text>
                <View style={{ marginTop: spacing.xs, gap: spacing.xs }}>
                  <KeyValue label="Issued Date" value={horizon.issued_date} />
                  <KeyValue label="Trained Leads" value={`${horizon.trained_leads} leads`} />
                  <KeyValue label="Min Skilful BSS" value={horizon.min_skilful_bss.toFixed(3)} />
                  {horizon.teleconnection_r != null && (
                    <KeyValue label="Teleconnection r" value={horizon.teleconnection_r.toFixed(3)} />
                  )}
                </View>
              </Card>
            </>
          ) : null}
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
  heroBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  heroPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  heroValueWrap: {
    marginVertical: spacing.xs,
  },
  heroBigTemp: {
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  heroSub: {
    fontSize: 12,
    marginTop: 2,
  },
  bars: { flexDirection: 'row', gap: 4, alignItems: 'flex-end', paddingTop: 8 },
  barCol: { flex: 1, alignItems: 'center', gap: 2 },
  barTrack: { height: 56, width: '100%' },
  bar: { width: '100%', borderRadius: radius.sm },
  barLabel: { fontSize: 8 },
  leadCard: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.xs,
  },
  leadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  leadMonthBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  leadMonthBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  leadTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  kindPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  kindPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  skillBox: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginTop: 4,
  },
  skillItem: {
    flex: 1,
    alignItems: 'center',
  },
  skillLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  skillVal: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 1,
  },
});
