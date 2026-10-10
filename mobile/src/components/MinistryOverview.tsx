import { LEAD_MONTHS, type CropMixEntry, type LeadMonth, type RiskBucket, type RiskLevel, type WoredaRisk } from '@agriminds/api-types';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { OfflineBanner, ProvenanceBanner } from '@/components/Banners';
import { Card } from '@/components/Card';
import { RiskBadge } from '@/components/RiskBadge';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Stat } from '@/components/Stat';
import { EmptyState, LoadingState } from '@/components/States';
import { useMinistryDashboard } from '@/features/useMinistry';
import { useI18n } from '@/i18n';
import { useSelection } from '@/state/selection';
import { radius, riskColors, spacing, useTheme } from '@/theme';

const RISK_LEVEL_ORDER: RiskLevel[] = ['Low', 'Moderate', 'High', 'Severe'];

export function MinistryOverview() {
  const { t, language } = useI18n();
  const { colors, dark } = useTheme();
  const sel = useSelection();
  const router = useRouter();

  const query = useMinistryDashboard(sel.lead);
  const data = query.data;
  const coverage = data?.coverage;
  const exposure = data?.exposure;

  if (query.isPending && !data) {
    return <LoadingState />;
  }

  if (query.isError && !data) {
    return (
      <EmptyState
        error={query.error}
        onRetry={() => query.refetch()}
      />
    );
  }

  const totalHectares = coverage?.hectares || 1;
  const totalPlots = coverage?.farms || 1;

  const atRiskCount = exposure?.farms_at_risk ?? 0;

  return (
    <View style={styles.container}>
      {/* Top Hero Contour Header (Matching Web) */}
      <View
        style={[
          styles.heroCard,
          {
            backgroundColor: dark ? '#0d1d33' : '#eaf2fd',
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.badgeRow}>
          <View style={[styles.pill, { backgroundColor: '#2563eb' }]}>
            <Ionicons name="shield-checkmark" size={12} color="#ffffff" />
            <Text style={[styles.pillText, { color: '#ffffff' }]}>
              {data?.scope || t('ministry.eyebrow')}
            </Text>
          </View>
        </View>

        <Text style={[styles.title, { color: colors.text }]}>
          {t('ministry.title')}
        </Text>
        <Text style={[styles.intro, { color: colors.textMuted }]}>
          {t('ministry.intro')}
        </Text>

        <View style={styles.leadSelector}>
          <SegmentedControl<LeadMonth>
            options={LEAD_MONTHS.map((l) => ({
              value: l,
              label: t(`advisory.lead${l}`),
            }))}
            value={sel.lead}
            onChange={sel.setLead}
          />
        </View>
      </View>

      {query.isError && data && (
        <OfflineBanner
          dataUpdatedAt={query.dataUpdatedAt}
          onRetry={() => query.refetch()}
        />
      )}

      {data?.provenance && <ProvenanceBanner provenance={data.provenance} />}

      {/* 4 Core Executive Metric Cards (Matching Web Stat.tsx) */}
      <View style={styles.statsGrid}>
        <Stat
          icon={<Ionicons name="people" size={17} color={colors.primary} />}
          label={t('ministry.registeredFarmers')}
          value={coverage?.farmers ?? '—'}
          detail={
            coverage
              ? t('ministry.activeLast30', { count: coverage.active_farmers_30d })
              : undefined
          }
        />

        <Stat
          icon={<Ionicons name="leaf" size={17} color="#059669" />}
          label={t('ministry.registeredPlots')}
          value={coverage?.farms ?? '—'}
          detail={
            coverage
              ? t('ministry.hectaresTotal', {
                  hectares: coverage.hectares.toFixed(1),
                })
              : undefined
          }
        />

        <Stat
          icon={<Ionicons name="map" size={17} color="#2563eb" />}
          label={t('ministry.woredasCovered')}
          value={
            coverage
              ? `${coverage.woredas_covered}/${coverage.woredas_total}`
              : '—'
          }
          detail={t('ministry.woredasDetail')}
        />

        <Stat
          icon={<Ionicons name="flame" size={17} color={atRiskCount > 0 ? '#dc2626' : colors.primary} />}
          label={t('ministry.plotsAtRisk')}
          value={exposure ? exposure.farms_at_risk : '—'}
          tone={atRiskCount > 0 ? 'danger' : undefined}
          detail={
            exposure
              ? t('ministry.atRiskDetail', {
                  farmers: exposure.farmers_at_risk,
                  hectares: exposure.hectares_at_risk.toFixed(1),
                })
              : t('ministry.exposureUnavailable')
          }
        />
      </View>

      {/* Source Note */}
      <Text style={[styles.sourceNote, { color: colors.textMuted }]}>
        {t('ministry.sourceNote')}
      </Text>

      {/* Risk Exposure Breakdown Card (Matching Web ExposureBreakdown) */}
      <Card
        icon={<Ionicons name="flame-outline" size={18} color="#ea580c" />}
        title={t('ministry.exposureCardTitle')}
        subtitle={t('ministry.exposureCardSubtitle')}
      >
        {exposure?.buckets ? (
          <View style={{ gap: spacing.md, marginTop: spacing.xs }}>
            {/* Proportional Stacked Color Bar */}
            <View style={styles.stackedBarContainer}>
              {RISK_LEVEL_ORDER.map((lvl) => {
                const b = exposure.buckets.find((x) => x.risk_level === lvl);
                const count = b?.farms ?? 0;
                if (count === 0) return null;
                const pct = Math.max((count / totalPlots) * 100, 4);
                return (
                  <View
                    key={lvl}
                    style={{
                      width: `${pct}%`,
                      height: '100%',
                      backgroundColor: riskColors[lvl].bg,
                    }}
                  />
                );
              })}
            </View>

            {/* Table / List */}
            <View style={styles.exposureTable}>
              <View style={[styles.tableHeaderRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.tableHeaderCell, { color: colors.textMuted }]}>
                  {t('ministry.level')}
                </Text>
                <Text style={[styles.tableHeaderCell, { color: colors.textMuted, textAlign: 'right' }]}>
                  {t('ministry.plots')}
                </Text>
                <Text style={[styles.tableHeaderCell, { color: colors.textMuted, textAlign: 'right' }]}>
                  {t('ministry.farmers')}
                </Text>
                <Text style={[styles.tableHeaderCell, { color: colors.textMuted, textAlign: 'right' }]}>
                  {t('ministry.hectares')}
                </Text>
              </View>

              {exposure.buckets.map((b: RiskBucket) => {
                const c = riskColors[b.risk_level];
                return (
                  <View key={b.risk_level} style={[styles.tableRow, { borderBottomColor: colors.border }]}>
                    <View style={styles.levelCell}>
                      <View style={[styles.dot, { backgroundColor: c.bg }]} />
                      <Text style={[styles.levelName, { color: colors.text }]}>
                        {t(`risk.${b.risk_level}`)}
                      </Text>
                    </View>
                    <Text style={[styles.tableCell, { color: colors.text, textAlign: 'right' }]}>
                      {b.farms}
                    </Text>
                    <Text style={[styles.tableCell, { color: colors.text, textAlign: 'right' }]}>
                      {b.farmers}
                    </Text>
                    <Text style={[styles.tableCell, { color: colors.text, textAlign: 'right' }]}>
                      {b.hectares.toFixed(1)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : (
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>
            {t('ministry.exposureUnavailable')}
          </Text>
        )}
      </Card>

      {/* Crop Mix Card (Matching Web CropMix) */}
      {data?.crop_mix && data.crop_mix.length > 0 && (
        <Card
          icon={<Ionicons name="nutrition-outline" size={18} color="#059669" />}
          title={t('ministry.cropMixTitle')}
          subtitle={t('ministry.cropMixSubtitle')}
        >
          <View style={{ gap: spacing.md, marginTop: spacing.xs }}>
            {data.crop_mix.map((item: CropMixEntry) => {
              const share = totalHectares > 0 ? (item.hectares / totalHectares) * 100 : 0;
              return (
                <View key={item.crop} style={{ gap: 4 }}>
                  <View style={styles.cropTopRow}>
                    <Text style={[styles.cropName, { color: colors.text }]}>
                      {t(`crops.${item.crop}`)}
                    </Text>
                    <Text style={[styles.cropMeta, { color: colors.textMuted }]}>
                      {item.hectares.toFixed(1)} ha ({item.farms}{' '}
                      {t('ministry.plots').toLowerCase()}) · {Math.round(share)}%
                    </Text>
                  </View>
                  <View style={[styles.cropProgressBg, { backgroundColor: dark ? '#222222' : '#e5e7eb' }]}>
                    <View
                      style={[
                        styles.cropProgressFill,
                        {
                          backgroundColor:
                            item.crop === 'tef'
                              ? '#059669'
                              : item.crop === 'wheat'
                                ? '#f59e0b'
                                : '#2563eb',
                          width: `${Math.max(share, 2)}%`,
                        },
                      ]}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </Card>
      )}

      {/* By Woreda Table Card (Matching Web WoredaTable) */}
      {data?.by_woreda && data.by_woreda.length > 0 && (
        <Card
          icon={<Ionicons name="map-outline" size={18} color="#2563eb" />}
          title={t('ministry.byWoredaTitle')}
          subtitle={t('ministry.byWoredaSubtitle')}
        >
          <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
            {data.by_woreda.map((row: WoredaRisk) => {
              const name =
                language === 'am'
                  ? row.name_am
                  : language === 'or'
                    ? row.name_om
                    : row.name_en;

              return (
                <View
                  key={row.woreda_id}
                  style={[
                    styles.woredaCard,
                    {
                      backgroundColor: dark ? '#171717' : '#f8fafc',
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.woredaName, { color: colors.text }]}>
                      {name}
                    </Text>
                    <Text style={[styles.woredaSub, { color: colors.textMuted }]}>
                      {row.farmers} {t('ministry.farmers').toLowerCase()} ·{' '}
                      {row.farms} {t('ministry.plots').toLowerCase()} ·{' '}
                      {row.hectares.toFixed(1)} ha
                    </Text>
                  </View>
                  <RiskBadge
                    level={row.worst_risk_level}
                    probability={row.mean_probability}
                  />
                </View>
              );
            })}
          </View>
        </Card>
      )}

      {/* Advisory Delivery Metrics Card (Matching Web DeliveryCard) */}
      {data?.advisories && (
        <Card
          icon={<Ionicons name="mail-unread-outline" size={18} color={colors.primary} />}
          title={t('ministry.deliveryTitle')}
          subtitle={t('ministry.deliverySubtitle')}
        >
          <View style={styles.deliveryGrid}>
            <View style={styles.deliveryTile}>
              <Text style={[styles.deliveryValue, { color: colors.text }]}>
                {data.advisories.issued_total}
              </Text>
              <Text style={[styles.deliveryLabel, { color: colors.textMuted }]}>
                {t('ministry.issuedTotal')}
              </Text>
            </View>

            <View style={styles.deliveryTile}>
              <Text style={[styles.deliveryValue, { color: colors.text }]}>
                {data.advisories.issued_30d}
              </Text>
              <Text style={[styles.deliveryLabel, { color: colors.textMuted }]}>
                {t('ministry.issued30d')}
              </Text>
            </View>

            <View style={styles.deliveryTile}>
              <Text style={[styles.deliveryValue, { color: colors.text }]}>
                {data.advisories.acknowledged_30d}
              </Text>
              <Text style={[styles.deliveryLabel, { color: colors.textMuted }]}>
                {t('ministry.acknowledged30d')}
              </Text>
            </View>
          </View>

          <View style={[styles.deliveryRateBox, { borderTopColor: colors.border }]}>
            <View style={styles.rateTopRow}>
              <Text style={[styles.rateLabel, { color: colors.textMuted }]}>
                {t('ministry.acknowledgementRate')}
              </Text>
              <Text style={[styles.rateValue, { color: '#059669' }]}>
                {Math.round((data.advisories.acknowledgement_rate ?? 0) * 100)}%
              </Text>
            </View>
            <View style={[styles.cropProgressBg, { backgroundColor: dark ? '#222222' : '#e5e7eb' }]}>
              <View
                style={[
                  styles.cropProgressFill,
                  {
                    backgroundColor: '#059669',
                    width: `${Math.min((data.advisories.acknowledgement_rate ?? 0) * 100, 100)}%`,
                  },
                ]}
              />
            </View>
          </View>
        </Card>
      )}

      {/* Shortcut link to Watershed Grid */}
      <TouchableOpacity
        onPress={() => router.push('/(tabs)/grid' as any)}
        style={[
          styles.watershedLink,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
        accessibilityRole="button"
      >
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={[styles.linkTitle, { color: colors.text }]}>
            {t('ministry.watershedLinkTitle')}
          </Text>
          <Text style={[styles.linkBody, { color: colors.textMuted }]}>
            {t('ministry.watershedLinkBody')}
          </Text>
        </View>
        <Ionicons name="arrow-forward" size={20} color={colors.primary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.lg },
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
  pillText: { fontSize: 11, fontWeight: '700' },
  title: { fontSize: 24, fontWeight: '800', marginTop: 4, letterSpacing: -0.5 },
  intro: { fontSize: 13, lineHeight: 19 },
  leadSelector: { marginTop: spacing.xs },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  sourceNote: {
    fontSize: 12,
    lineHeight: 16,
    paddingHorizontal: 4,
  },
  stackedBarContainer: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#e5e7eb',
  },
  exposureTable: {
    marginTop: 4,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
  },
  tableHeaderCell: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  levelCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  levelName: {
    fontSize: 13,
    fontWeight: '600',
  },
  tableCell: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  cropTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cropName: { fontSize: 13, fontWeight: '700' },
  cropMeta: { fontSize: 12 },
  cropProgressBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  cropProgressFill: { height: '100%', borderRadius: 4 },
  woredaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: 14,
    borderWidth: 1,
    gap: spacing.sm,
  },
  woredaName: { fontSize: 14, fontWeight: '700' },
  woredaSub: { fontSize: 12, marginTop: 2 },
  deliveryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  deliveryTile: {
    flex: 1,
    gap: 2,
  },
  deliveryValue: { fontSize: 24, fontWeight: '800' },
  deliveryLabel: { fontSize: 11, marginTop: 2 },
  deliveryRateBox: {
    borderTopWidth: 1,
    paddingTop: spacing.md,
    gap: 6,
  },
  rateTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rateLabel: { fontSize: 13 },
  rateValue: { fontSize: 15, fontWeight: '800' },
  watershedLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderRadius: 18,
    borderWidth: 1,
    gap: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  linkTitle: { fontSize: 15, fontWeight: '700' },
  linkBody: { fontSize: 12, lineHeight: 16 },
});
