import { CROPS, LEAD_MONTHS, type Crop, type LeadMonth } from '@agriminds/api-types';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { OfflineBanner, ProvenanceBanner } from '@/components/Banners';
import { Card, Label } from '@/components/Card';
import { KeyValue, Section } from '@/components/KeyValue';
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

export default function AdvisoryScreen() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const sel = useSelection();
  const advisory = useAdvisory();
  const gps = useDeviceLocation();

  const onLocate = async () => {
    const pos = await gps.locate();
    if (pos) sel.useGps(pos.latitude, pos.longitude);
  };

  const data = advisory.data;
  const outside = advisory.error instanceof ApiError && advisory.error.code === 'invalid_location';
  const showOffline = advisory.isError && !!data && !outside;
  const isMinister = sel.role === 'minister';

  return (
    <Screen title={t('advisory.title')} subtitle={t('subtitle')} refreshing={advisory.isFetching && !!data} onRefresh={() => advisory.refetch()}>
      {isMinister ? (
        <Card style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.primary, borderWidth: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
            <Ionicons name="stats-chart" size={20} color={colors.primary} />
            <Text style={{ fontSize: 16, fontWeight: '800', color: colors.primary }}>
              {t('ministerView.title')}
            </Text>
          </View>
          <Text style={{ fontSize: 13, color: colors.text, lineHeight: 18, marginBottom: spacing.sm }}>
            {t('ministerView.macroBrief')}
          </Text>
          <View style={{ backgroundColor: colors.warningBg, padding: spacing.md, borderRadius: radius.md, gap: 4 }}>
            <Text style={{ fontWeight: '700', color: colors.warningFg, fontSize: 13 }}>
              {t('ministerView.policyAction')}
            </Text>
            <Text style={{ color: colors.warningFg, fontSize: 12, lineHeight: 17 }}>
              {t('ministerView.policyActionText')}
            </Text>
          </View>
        </Card>
      ) : null}

      <Card>
        <Label>{t('advisory.crop')}</Label>
        <SegmentedControl<Crop> options={CROPS.map((c) => ({ value: c, label: t(`crops.${c}`) }))} value={sel.crop} onChange={sel.setCrop} />
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
        <Pressable onPress={onLocate} style={[styles.locate, { borderColor: colors.border }]} accessibilityRole="button" disabled={gps.status === 'locating'}>
          <Ionicons name="locate-outline" size={18} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: '700' }}>{gps.status === 'locating' ? t('advisory.locating') : t('advisory.useLocation')}</Text>
        </Pressable>
        {gps.status === 'denied' ? <Text style={{ color: colors.dangerFg }}>{t('advisory.locationDenied')}</Text> : null}
        {outside ? <Text style={{ color: colors.dangerFg }}>{t('advisory.locationOutside')}</Text> : null}
      </Card>

      {showOffline ? <OfflineBanner dataUpdatedAt={advisory.dataUpdatedAt} onRetry={() => advisory.refetch()} /> : null}

      {!data && advisory.isPending ? <LoadingState /> : null}
      {!data && advisory.isError ? <EmptyState error={advisory.error} onRetry={() => advisory.refetch()} /> : null}

      {data ? (
        <>
          <Card right={<RiskBadge level={data.risk_level} probability={data.adjusted_probability} large />} title={t(`crops.${data.crop}`)} subtitle={data.target_date}>
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
            <Text style={{ color: colors.textMuted, fontSize: 11 }}>{t('advisory.rules', { version: data.rules_version })}</Text>
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  locate: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, justifyContent: 'center' },
});
