import type { AdvisoryResponse, PdsiCategory, RiskLevel } from '@agriminds/api-types';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useI18n } from '@/i18n';
import { radius, spacing, useTheme } from '@/theme';

import { ensoKey, pdsiKey } from './FarmerOverview';

interface Props {
  advisory: AdvisoryResponse;
  plotName?: string;
  advisoryId?: string | null;
  acknowledged?: boolean;
  onAcknowledge?: () => void;
  acknowledging?: boolean;
  ground?: PdsiCategory | null;
}

const RISK_CONFIG: Record<
  RiskLevel,
  {
    icon: keyof typeof Ionicons.glyphMap;
    border: string;
    lightBg: string;
    darkBg: string;
    fg: string;
  }
> = {
  Low: {
    icon: 'shield-checkmark',
    border: '#059669',
    lightBg: '#ecfdf5',
    darkBg: '#09251a',
    fg: '#059669',
  },
  Moderate: {
    icon: 'alert-circle',
    border: '#d97706',
    lightBg: '#fffbeb',
    darkBg: '#2a1d08',
    fg: '#d97706',
  },
  High: {
    icon: 'warning',
    border: '#ea580c',
    lightBg: '#fff7ed',
    darkBg: '#30180a',
    fg: '#ea580c',
  },
  Severe: {
    icon: 'alert',
    border: '#dc2626',
    lightBg: '#fef2f2',
    darkBg: '#330e0e',
    fg: '#dc2626',
  },
};

function DirectiveItem({
  icon,
  title,
  body,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
}) {
  const { colors, dark } = useTheme();

  return (
    <View
      style={[
        styles.directiveCard,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      <View
        style={[
          styles.directiveIconBox,
          {
            backgroundColor: dark ? '#13281b' : '#e6f7ec',
          },
        ]}
      >
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.directiveTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.directiveBody, { color: colors.textMuted }]}>{body}</Text>
      </View>
    </View>
  );
}

export function AdvisoryActionCard({
  advisory,
  plotName,
  advisoryId,
  acknowledged,
  onAcknowledge,
  acknowledging,
  ground,
}: Props) {
  const { t, language } = useI18n();
  const { colors, dark } = useTheme();

  const level = advisory.risk_level as RiskLevel;
  const cfg = RISK_CONFIG[level] || RISK_CONFIG.Low;

  const cardBg = dark ? cfg.darkBg : cfg.lightBg;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: cardBg,
          borderColor: colors.border,
          borderLeftColor: cfg.border,
        },
      ]}
    >
      {/* Top Banner Row */}
      <View style={styles.topSection}>
        <View style={styles.topLeft}>
          <View style={[styles.riskIconCircle, { backgroundColor: cfg.border }]}>
            <Ionicons name={cfg.icon} size={24} color="#ffffff" />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.eyebrow, { color: colors.textMuted }]}>
              {plotName ? t('farmer.adviceForPlot', { plot: plotName }) : t('farmer.adviceTitle')}
            </Text>
            <Text style={[styles.riskHeading, { color: cfg.fg }]}>
              {t(`risk.${level}`)}
            </Text>
            <Text style={[styles.metaLine, { color: colors.textMuted }]} numberOfLines={2}>
              {t(`crops.${advisory.crop}`)} · {advisory.target_date} · {advisory.season}
              {advisory.enso_category
                ? ` · ${t(`ensoBand.${ensoKey(advisory.enso_category)}` as any)}`
                : ''}
            </Text>
          </View>
        </View>

        {/* Probability & Ground Status */}
        <View style={styles.topRight}>
          <Text style={[styles.probabilityNum, { color: cfg.fg }]}>
            {Math.round(advisory.adjusted_probability * 100)}%
          </Text>
          <Text style={[styles.probLabel, { color: colors.textMuted }]}>
            {t('farmer.chanceOfDrought', { crop: t(`crops.${advisory.crop}`) })}
          </Text>
          {ground ? (
            <View
              style={[
                styles.groundPill,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <Ionicons name="earth" size={13} color={colors.primary} />
              <Text style={[styles.groundText, { color: colors.text }]}>
                {t('farmer.groundNow', { band: t(`pdsi.${pdsiKey(ground)}` as any) })}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* 4 Action Directives in 2x2 Grid */}
      <View style={styles.directivesGrid}>
        <DirectiveItem
          icon="nutrition-outline"
          title={t('advisory.strategy')}
          body={advisory.crop_recommendation}
        />
        <DirectiveItem
          icon="time-outline"
          title={t('advisory.planting')}
          body={advisory.planting_window}
        />
        <DirectiveItem
          icon="water-outline"
          title={t('advisory.water')}
          body={advisory.water_management}
        />
        <DirectiveItem
          icon="shield-outline"
          title={t('advisory.preparedness')}
          body={advisory.preparedness_action}
        />
      </View>

      {/* IEK Assessment & Confidence Badge */}
      <View
        style={[
          styles.iekBox,
          {
            backgroundColor: dark ? '#1c1c1c' : '#f9fafb',
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.iekRow}>
          <Ionicons name="sparkles" size={16} color="#d97706" style={{ marginTop: 2 }} />
          <Text style={[styles.iekText, { color: colors.textMuted }]}>
            {advisory.iek_assessment}
          </Text>
        </View>
        <View
          style={[
            styles.confidenceBadge,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Ionicons name="shield-checkmark" size={13} color={colors.primary} />
          <Text style={[styles.confidenceText, { color: colors.primary }]}>
            {advisory.confidence_level}
          </Text>
        </View>
      </View>

      {/* Acknowledge Advisory Action */}
      {advisoryId && onAcknowledge ? (
        <View style={[styles.ackRow, { borderTopColor: colors.border }]}>
          {acknowledged ? (
            <View style={styles.ackDoneBox}>
              <Ionicons name="checkmark-circle" size={22} color="#059669" />
              <Text style={styles.ackDoneText}>{t('farmer.acknowledged')}</Text>
            </View>
          ) : (
            <TouchableOpacity
              onPress={onAcknowledge}
              disabled={acknowledging}
              style={[styles.ackBtn, { backgroundColor: colors.primary }]}
              accessibilityRole="button"
            >
              {acknowledging ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={18} color="#ffffff" />
                  <Text style={styles.ackBtnText}>{t('farmer.acknowledge')}</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 18,
    borderWidth: 1,
    borderLeftWidth: 5,
    padding: spacing.lg,
    gap: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  topSection: {
    gap: spacing.md,
  },
  topLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  riskIconCircle: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  riskHeading: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 2,
  },
  metaLine: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  topRight: {
    alignItems: 'flex-start',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.08)',
    paddingTop: spacing.sm,
    gap: 2,
  },
  probabilityNum: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -1,
  },
  probLabel: {
    fontSize: 12,
  },
  groundPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    marginTop: 4,
  },
  groundText: {
    fontSize: 11,
    fontWeight: '600',
  },
  directivesGrid: {
    gap: spacing.sm,
  },
  directiveCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: 14,
    borderWidth: 1,
  },
  directiveIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  directiveTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  directiveBody: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  iekBox: {
    padding: spacing.md,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    gap: spacing.sm,
  },
  iekRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  iekText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  confidenceText: {
    fontSize: 11,
    fontWeight: '700',
  },
  ackRow: {
    borderTopWidth: 1,
    paddingTop: spacing.md,
  },
  ackDoneBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  ackDoneText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#059669',
  },
  ackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 14,
    borderRadius: radius.md,
  },
  ackBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
});
