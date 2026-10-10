import { LEAD_MONTHS, type Farm, type LeadMonth } from '@agriminds/api-types';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { OfflineBanner, ProvenanceBanner } from '@/components/Banners';
import { Card } from '@/components/Card';
import { SegmentedControl } from '@/components/SegmentedControl';
import { EmptyState, LoadingState } from '@/components/States';
import {
  useAcknowledgeAdvisory,
  useFarmAdvisory,
  useFarmerDashboard,
} from '@/features/useFarmer';
import { useI18n } from '@/i18n';
import { useSelection } from '@/state/selection';
import { radius, spacing, useTheme } from '@/theme';

import { AdvisoryActionCard } from './AdvisoryActionCard';
import { PlotCard } from './PlotCard';

export type EnsoBandKey =
  | 'highElNino'
  | 'moderateElNino'
  | 'neutral'
  | 'moderateLaNina'
  | 'highLaNina';

export type PdsiKey =
  | 'extremelyDry'
  | 'veryDry'
  | 'moderatelyDry'
  | 'normal'
  | 'moderatelyWet'
  | 'veryWet'
  | 'extremelyWet';

export function ensoKey(cat?: string | null): EnsoBandKey {
  if (!cat) return 'neutral';
  switch (cat) {
    case 'High El Niño':
      return 'highElNino';
    case 'Moderate El Niño':
      return 'moderateElNino';
    case 'Neutral':
      return 'neutral';
    case 'Moderate La Niña':
      return 'moderateLaNina';
    case 'High La Niña':
      return 'highLaNina';
    default:
      return 'neutral';
  }
}

export function pdsiKey(cat?: string | null): PdsiKey {
  if (!cat) return 'normal';
  switch (cat) {
    case 'Extremely dry':
      return 'extremelyDry';
    case 'Very dry':
      return 'veryDry';
    case 'Moderately dry':
      return 'moderatelyDry';
    case 'Normal':
      return 'normal';
    case 'Moderately wet':
      return 'moderatelyWet';
    case 'Very wet':
      return 'veryWet';
    case 'Extremely wet':
      return 'extremelyWet';
    default:
      return 'normal';
  }
}

export function FarmerOverview() {
  const { t, language } = useI18n();
  const { colors, dark } = useTheme();
  const sel = useSelection();

  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null);
  const [acknowledgedIds, setAcknowledgedIds] = useState<Set<string>>(new Set());

  const dashboardQuery = useFarmerDashboard(sel.lead);
  const data = dashboardQuery.data;

  const activeId = selectedFarmId ?? data?.advisory_farm_id ?? null;
  const isDefaultPlot = activeId === (data?.advisory_farm_id ?? null);

  const pickedQuery = useFarmAdvisory(activeId, sel.lead, !isDefaultPlot);
  const advisory = isDefaultPlot ? data?.advisory : pickedQuery.data;
  const activeFarm = data?.farms.find((f) => f.id === activeId);

  const recordId = isDefaultPlot
    ? (data?.advisory_record_id ?? null)
    : (pickedQuery.data?.record_id ?? null);

  const isServerAcknowledged = isDefaultPlot
    ? Boolean(data?.advisory_acknowledged_at)
    : Boolean(pickedQuery.data?.acknowledged_at);

  const isAcknowledged =
    isServerAcknowledged || (recordId ? acknowledgedIds.has(recordId) : false);

  const acknowledgeMutation = useAcknowledgeAdvisory();

  const handleAcknowledge = () => {
    if (!recordId || isAcknowledged || acknowledgeMutation.isPending) return;
    setAcknowledgedIds((prev) => new Set(prev).add(recordId));
    acknowledgeMutation.mutate(recordId);
  };

  if (dashboardQuery.isPending && !data) {
    return <LoadingState />;
  }

  if (dashboardQuery.isError && !data) {
    return (
      <EmptyState
        error={dashboardQuery.error}
        onRetry={() => dashboardQuery.refetch()}
      />
    );
  }

  const woredaName =
    language === 'am'
      ? data?.user.woreda?.name_am
      : language === 'or'
        ? data?.user.woreda?.name_om
        : data?.user.woreda?.name_en;

  const farmerFirstName = data?.user.full_name?.split(' ')[0] ?? '';

  return (
    <View style={styles.container}>
      {/* Top Hero Contour Header (Matching Web) */}
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
            <Ionicons name="location" size={12} color="#ffffff" />
            <Text style={[styles.pillText, { color: '#ffffff' }]}>
              {woredaName ? `${woredaName} · Choke Basin` : t('farmer.eyebrow')}
            </Text>
          </View>
          {data?.enso_category && (
            <View
              style={[
                styles.pill,
                { backgroundColor: dark ? '#152e3c' : '#e1f0fa' },
              ]}
            >
              <Ionicons name="water" size={12} color="#0284c7" />
              <Text style={[styles.pillText, { color: '#0284c7' }]}>
                {t('farmer.ensoNowBand', {
                  band: t(`ensoBand.${ensoKey(data.enso_category)}` as any),
                })}
              </Text>
            </View>
          )}
        </View>

        <Text style={[styles.greeting, { color: colors.text }]}>
          {farmerFirstName
            ? t('farmer.greeting', { name: farmerFirstName })
            : t('farmer.greetingPlain')}
        </Text>
        <Text style={[styles.intro, { color: colors.textMuted }]}>
          {t('farmer.intro')}
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

      {dashboardQuery.isError && data && (
        <OfflineBanner
          dataUpdatedAt={dashboardQuery.dataUpdatedAt}
          onRetry={() => dashboardQuery.refetch()}
        />
      )}

      {data?.provenance && <ProvenanceBanner provenance={data.provenance} />}

      {/* Primary Advisory Action Card */}
      {advisory ? (
        <AdvisoryActionCard
          advisory={advisory}
          plotName={activeFarm?.name}
          advisoryId={recordId}
          acknowledged={isAcknowledged}
          onAcknowledge={handleAcknowledge}
          acknowledging={acknowledgeMutation.isPending}
          ground={activeFarm?.risk?.pdsi_category}
        />
      ) : null}

      {/* Registered Plots List */}
      {data?.farms && data.farms.length > 0 && (
        <View style={styles.plotsSection}>
          <View style={styles.plotsHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {t('farmer.myPlots', { count: data.farms.length })}
            </Text>
            <Text style={[styles.plotsHint, { color: colors.textMuted }]}>
              {t('farmer.plotsHint')}
            </Text>
          </View>

          <View style={styles.plotsList}>
            {data.farms.map((farm: Farm) => {
              const isSelected = farm.id === activeId;
              return (
                <PlotCard
                  key={farm.id}
                  farm={farm}
                  selected={isSelected}
                  onSelect={() => setSelectedFarmId(farm.id)}
                  ground={farm.risk?.pdsi_category}
                />
              );
            })}
          </View>
        </View>
      )}

      {/* Regional Climate Outlook */}
      {data?.enso_summary && (
        <Card
          icon={<Ionicons name="planet-outline" size={18} color={colors.primary} />}
          title={t('enso.title')}
        >
          <Text style={[styles.ensoBody, { color: colors.text }]}>
            {data.enso_summary}
          </Text>
        </Card>
      )}
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
  greeting: { fontSize: 24, fontWeight: '800', marginTop: 4, letterSpacing: -0.5 },
  intro: { fontSize: 13, lineHeight: 19 },
  leadSelector: { marginTop: spacing.xs },
  plotsSection: { gap: spacing.sm },
  plotsHeaderRow: { gap: 2 },
  sectionTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  plotsHint: { fontSize: 12 },
  plotsList: { gap: spacing.md },
  ensoBody: { fontSize: 13, lineHeight: 20 },
});
