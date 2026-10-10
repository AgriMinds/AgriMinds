import { LEAD_MONTHS, type CropMixEntry, type LeadMonth, type RiskBucket, type WoredaRisk } from '@agriminds/api-types';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { OfflineBanner, ProvenanceBanner } from '@/components/Banners';
import { Card, Label } from '@/components/Card';
import { RiskBadge } from '@/components/RiskBadge';
import { SegmentedControl } from '@/components/SegmentedControl';
import { EmptyState, LoadingState } from '@/components/States';
import { useMinistryDashboard } from '@/features/useMinistry';
import { useI18n } from '@/i18n';
import { useSelection } from '@/state/selection';
import { radius, riskColors, spacing, useTheme } from '@/theme';

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

  return (
    <View style={styles.container}>
      {/* Header Banner */}
      <Card
        style={[
          styles.headerCard,
          {
            backgroundColor: dark ? '#0d1d33' : '#eaf2fd',
            borderColor: '#2563eb',
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
          <Label>{t('advisory.lead')}</Label>
          <SegmentedControl<LeadMonth>
            options={LEAD_MONTHS.map((l) => ({
              value: l,
              label: t(`advisory.lead${l}`),
            }))}
            value={sel.lead}
            onChange={sel.setLead}
          />
        </View>
      </Card>

      {query.isError && data && (
        <OfflineBanner
          dataUpdatedAt={query.dataUpdatedAt}
          onRetry={() => query.refetch()}
        />
      )}

      {data?.provenance && <ProvenanceBanner provenance={data.provenance} />}

      {/* 4 Core Executive Metric Cards */}
      <View style={styles.statsGrid}>
        <View
          style={[
            styles.statCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.statIconWrap}>
            <Ionicons name="people" size={18} color={colors.primary} />
          </View>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {coverage?.farmers ?? '—'}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>
            {t('ministry.registeredFarmers')}
          </Text>
          {coverage && (
            <Text style={[styles.statSub, { color: colors.primary }]}>
              {t('ministry.activeLast30', { count: coverage.active_farmers_30d })}
            </Text>
          )}
        </View>

        <View
          style={[
            styles.statCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.statIconWrap}>
            <Ionicons name="leaf" size={18} color="#059669" />
          </View>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {coverage?.farms ?? '—'}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>
            {t('ministry.registeredPlots')}
          </Text>
          {coverage && (
            <Text style={[styles.statSub, { color: colors.textMuted }]}>
              {t('ministry.hectaresTotal', {
                hectares: coverage.hectares.toFixed(1),
              })}
            </Text>
          )}
        </View>

        <View
          style={[
            styles.statCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.statIconWrap}>
            <Ionicons name="map" size={18} color="#2563eb" />
          </View>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {coverage
              ? `${coverage.woredas_covered}/${coverage.woredas_total}`
              : '—'}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>
            {t('ministry.woredasCovered')}
          </Text>
          <Text style={[styles.statSub, { color: colors.textMuted }]}>
            {t('ministry.woredasDetail')}
          </Text>
        </View>

        <View
          style={[
            styles.statCard,
            {
              backgroundColor: colors.surface,
              borderColor: (exposure?.farms_at_risk ?? 0) > 0 ? '#ea580c' : colors.border,
            },
          ]}
        >
          <View style={styles.statIconWrap}>
            <Ionicons
              name="flame"
              size={18}
              color={(exposure?.farms_at_risk ?? 0) > 0 ? '#dc2626' : colors.primary}
            />
          </View>
          <Text
            style={[
              styles.statValue,
              {
                color:
                  (exposure?.farms_at_risk ?? 0) > 0 ? '#dc2626' : colors.text,
              },
            ]}
          >
            {exposure ? exposure.farms_at_risk : '—'}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>
            {t('ministry.plotsAtRisk')}
          </Text>
          {exposure && (
            <Text style={[styles.statSub, { color: colors.textMuted }]}>
              {t('ministry.atRiskDetail', {
                farmers: exposure.farmers_at_risk,
                hectares: exposure.hectares_at_risk.toFixed(1),
              })}
            </Text>
          )}
        </View>
      </View>

      {/* Risk Exposure Breakdown Card */}
      <Card
        title={t('ministry.exposureCardTitle')}
        subtitle={t('ministry.exposureCardSubtitle')}
      >
        {exposure?.buckets ? (
          <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
            {exposure.buckets.map((b: RiskBucket) => {
              const c = riskColors[b.risk_level];
              const pct =
                coverage && coverage.farms > 0
                  ? Math.round((b.farms / coverage.farms) * 100)
                  : 0;
              return (
                <View key={b.risk_level} style={styles.bucketRow}>
                  <View style={styles.bucketLabelWrap}>
                    <View style={[styles.bucketDot, { backgroundColor: c.bg }]} />
                    <Text style={[styles.bucketLevelText, { color: colors.text }]}>
                      {t(`risk.${b.risk_level}`)}
                    </Text>
                  </View>
                  <View style={styles.bucketProgressBg}>
                    <View
                      style={[
                        styles.bucketProgressFill,
                        {
                          backgroundColor: c.bg,
                          width: `${Math.max(pct, 2)}%`,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.bucketStats, { color: colors.textMuted }]}>
                    {b.farms} {t('ministry.plots').toLowerCase()} ({pct}%)
                  </Text>
                </View>
              );
            })}
          </View>
        ) : (
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>
            {t('ministry.exposureUnavailable')}
          </Text>
        )}
      </Card>

      {/* Crop Mix Card */}
      {data?.crop_mix && data.crop_mix.length > 0 && (
        <Card
          title={t('ministry.cropMixTitle')}
          subtitle={t('ministry.cropMixSubtitle')}
        >
          <View style={{ gap: spacing.md, marginTop: spacing.xs }}>
            {data.crop_mix.map((item: CropMixEntry) => {
              const pct = Math.round((item.hectares / totalHectares) * 100);
              return (
                <View key={item.crop} style={{ gap: 4 }}>
                  <View style={styles.cropTopRow}>
                    <Text style={[styles.cropName, { color: colors.text }]}>
                      {t(`crops.${item.crop}`)}
                    </Text>
                    <Text style={[styles.cropMeta, { color: colors.textMuted }]}>
                      {item.hectares.toFixed(1)} ha ({item.farms}{' '}
                      {t('ministry.plots').toLowerCase()}) · {pct}%
                    </Text>
                  </View>
                  <View style={styles.cropProgressBg}>
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
                          width: `${pct}%`,
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

      {/* By Woreda Breakdown Card */}
      {data?.by_woreda && data.by_woreda.length > 0 && (
        <Card
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
                  <View style={{ flex: 1 }}>
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

      {/* Advisory Delivery Metrics Card */}
      {data?.advisories && (
        <Card
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

            <View style={styles.deliveryTile}>
              <Text style={[styles.deliveryValue, { color: '#059669' }]}>
                {Math.round((data.advisories.acknowledgement_rate ?? 0) * 100)}%
              </Text>
              <Text style={[styles.deliveryLabel, { color: colors.textMuted }]}>
                {t('ministry.acknowledgementRate')}
              </Text>
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
        <View style={{ flex: 1, gap: 2 }}>
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
  headerCard: { padding: spacing.lg, gap: spacing.sm, borderWidth: 1 },
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
  title: { fontSize: 22, fontWeight: '800', marginTop: 4 },
  intro: { fontSize: 13, lineHeight: 18 },
  leadSelector: { marginTop: spacing.xs },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    minWidth: 140,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 2,
  },
  statIconWrap: { marginBottom: 2 },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 12, fontWeight: '600' },
  statSub: { fontSize: 11, marginTop: 2 },
  bucketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  bucketLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: 80,
  },
  bucketDot: { width: 8, height: 8, borderRadius: 4 },
  bucketLevelText: { fontSize: 12, fontWeight: '700' },
  bucketProgressBg: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e5e7eb',
    overflow: 'hidden',
  },
  bucketProgressFill: { height: '100%', borderRadius: 4 },
  bucketStats: { fontSize: 11, width: 100, textAlign: 'right' },
  cropTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cropName: { fontSize: 13, fontWeight: '700' },
  cropMeta: { fontSize: 11 },
  cropProgressBg: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  cropProgressFill: { height: '100%', borderRadius: 4 },
  woredaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    gap: spacing.sm,
  },
  woredaName: { fontSize: 14, fontWeight: '700' },
  woredaSub: { fontSize: 11, marginTop: 2 },
  deliveryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  deliveryTile: {
    flex: 1,
    minWidth: 120,
    padding: spacing.sm,
    gap: 2,
  },
  deliveryValue: { fontSize: 18, fontWeight: '800' },
  deliveryLabel: { fontSize: 11 },
  watershedLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
  },
  linkTitle: { fontSize: 15, fontWeight: '700' },
  linkBody: { fontSize: 12 },
});
