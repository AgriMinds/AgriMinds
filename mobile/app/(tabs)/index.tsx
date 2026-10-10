import { CROPS, LEAD_MONTHS, type Crop, type LeadMonth } from '@agriminds/api-types';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { OfflineBanner, ProvenanceBanner } from '@/components/Banners';
import { Card, Label } from '@/components/Card';
import { FarmerOverview } from '@/components/FarmerOverview';
import { KeyValue, Section } from '@/components/KeyValue';
import { MinistryOverview } from '@/components/MinistryOverview';
import { RiskBadge } from '@/components/RiskBadge';
import { Screen } from '@/components/Screen';
import { SegmentedControl } from '@/components/SegmentedControl';
import { EmptyState, LoadingState } from '@/components/States';
import { useAdvisory } from '@/features/useAdvisory';
import { useDeviceLocation } from '@/features/useLocation';
import { useI18n } from '@/i18n';
import { ApiError } from '@/services/api';
import { useSelection } from '@/state/selection';
import { radius, spacing, useTheme } from '@/theme';

type ViewMode = 'dashboard' | 'simulator';

export default function AdvisoryScreen() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const sel = useSelection();
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');

  const advisory = useAdvisory();
  const gps = useDeviceLocation();

  const onLocate = async () => {
    const pos = await gps.locate();
    if (pos) sel.useGps(pos.latitude, pos.longitude);
  };

  const data = advisory.data;
  const outside = advisory.error instanceof ApiError && advisory.error.code === 'invalid_location';
  const showOffline = advisory.isError && !!data && !outside;

  const isMinisterOrDa = sel.role === 'minister' || sel.role === 'da';

  return (
    <Screen
      title={viewMode === 'simulator' ? t('advisory.title') : undefined}
      subtitle={viewMode === 'simulator' ? t('subtitle') : undefined}
      refreshing={advisory.isFetching && !!data}
      onRefresh={() => advisory.refetch()}
    >
      {/* Top Mode Segment Switcher: Live Dashboard vs Simulator */}
      <View style={styles.modeSwitchWrapper}>
        <SegmentedControl<ViewMode>
          options={[
            { value: 'dashboard', label: t('modes.dashboard') },
            { value: 'simulator', label: t('modes.simulator') },
          ]}
          value={viewMode}
          onChange={setViewMode}
        />
      </View>

      {/* DASHBOARD MODE: Role-specific view */}
      {viewMode === 'dashboard' ? (
        isMinisterOrDa ? (
          <MinistryOverview />
        ) : (
          <FarmerOverview />
        )
      ) : (
        /* SIMULATOR MODE: Scenario evaluation */
        <>
          <Card>
            <Label>{t('advisory.crop')}</Label>
            <SegmentedControl<Crop>
              options={CROPS.map((c) => ({ value: c, label: t(`crops.${c}`) }))}
              value={sel.crop}
              onChange={sel.setCrop}
            />
            <Label>{t('advisory.lead')}</Label>
            <SegmentedControl<LeadMonth>
              options={LEAD_MONTHS.map((l) => ({ value: l, label: t(`advisory.lead${l}`) }))}
              value={sel.lead}
              onChange={sel.setLead}
            />
            <Label>{t('advisory.iek')}</Label>
            <SegmentedControl<boolean | null>
              options={[
                { value: null, label: t('advisory.iekUnset') },
                { value: true, label: t('advisory.iekAgree') },
                { value: false, label: t('advisory.iekDisagree') },
              ]}
              value={sel.iekAgrees}
              onChange={sel.setIek}
            />
            <Pressable
              onPress={onLocate}
              style={[styles.locate, { borderColor: colors.border }]}
              accessibilityRole="button"
              disabled={gps.status === 'locating'}
            >
              <Ionicons name="locate-outline" size={18} color={colors.primary} />
              <Text style={{ color: colors.primary, fontWeight: '700' }}>
                {gps.status === 'locating' ? t('advisory.locating') : t('advisory.useLocation')}
              </Text>
            </Pressable>
            {gps.status === 'denied' ? <Text style={{ color: colors.dangerFg }}>{t('advisory.locationDenied')}</Text> : null}
            {outside ? <Text style={{ color: colors.dangerFg }}>{t('advisory.locationOutside')}</Text> : null}
          </Card>

          {showOffline ? <OfflineBanner dataUpdatedAt={advisory.dataUpdatedAt} onRetry={() => advisory.refetch()} /> : null}

          {!data && advisory.isPending ? <LoadingState /> : null}
          {!data && advisory.isError ? <EmptyState error={advisory.error} onRetry={() => advisory.refetch()} /> : null}

          {data ? (
            <>
              <Card
                right={<RiskBadge level={data.risk_level} probability={data.adjusted_probability} large />}
                title={t(`crops.${data.crop}`)}
                subtitle={data.target_date}
              >
                <ProvenanceBanner provenance={data.provenance} />
                <View style={{ gap: spacing.xs }}>
                  <KeyValue label={t('advisory.cell')} value={`${data.row} / ${data.col}`} />
                  <KeyValue label={t('advisory.rawRisk')} value={`${Math.round(data.raw_probability * 100)}%`} />
                  <KeyValue label={t('advisory.adjustedRisk')} value={`${Math.round(data.adjusted_probability * 100)}%`} />
                  <KeyValue label={t('advisory.season')} value={data.season} />
                  <KeyValue label={t('advisory.enso')} value={data.enso_state} />
                  <KeyValue label={t('advisory.confidence')} value={data.confidence_level} />
                </View>
              </Card>
              <Card>
                <Section title={t('advisory.strategy')} body={data.crop_recommendation} />
                <Section title={t('advisory.planting')} body={data.planting_window} />
                <Section title={t('advisory.water')} body={data.water_management} />
                <Section title={t('advisory.preparedness')} body={data.preparedness_action} />
                <Section title={t('advisory.iek')} body={data.iek_assessment} />
                <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                  {t('advisory.rules', { version: data.rules_version })}
                </Text>
              </Card>
            </>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  modeSwitchWrapper: {
    marginBottom: spacing.xs,
  },
  locate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    justifyContent: 'center',
  },
});
