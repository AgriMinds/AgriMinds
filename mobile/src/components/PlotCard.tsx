import type { Farm, PdsiCategory, RiskLevel } from '@agriminds/api-types';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { RiskBadge } from '@/components/RiskBadge';
import { useI18n } from '@/i18n';
import { radius, spacing, useTheme } from '@/theme';

import { pdsiKey } from './FarmerOverview';

interface Props {
  farm: Farm;
  selected: boolean;
  onSelect: () => void;
  onEdit?: () => void;
  onLocateOnGrid?: () => void;
  onViewYield?: () => void;
  ground?: PdsiCategory | null;
}

export function PlotCard({
  farm,
  selected,
  onSelect,
  onEdit,
  onLocateOnGrid,
  onViewYield,
  ground,
}: Props) {
  const { t } = useI18n();
  const { colors, dark } = useTheme();

  const level = farm.risk?.risk_level as RiskLevel | undefined;

  return (
    <Pressable
      onPress={onSelect}
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: selected ? colors.primary : colors.border,
          borderWidth: selected ? 2 : 1,
          shadowColor: dark ? '#000000' : '#0e3d30',
        },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      {/* Top Title & Crop / Area Row */}
      <View style={styles.topRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {farm.name}
          </Text>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="expand-outline" size={13} color={colors.textMuted} />
              <Text style={[styles.metaText, { color: colors.textMuted }]}>
                {farm.area_hectares} {t('farmer.hectaresShort')}
              </Text>
            </View>
            <Text style={{ color: colors.border }}>·</Text>
            <Text style={[styles.metaText, { color: colors.textMuted }]}>
              {t(`crops.${farm.primary_crop}`)}
            </Text>
          </View>
        </View>

        <View style={styles.topActions}>
          {selected ? (
            <View style={[styles.activePill, { backgroundColor: colors.primary }]}>
              <Ionicons name="checkmark" size={12} color="#ffffff" />
              <Text style={styles.activePillText}>Active</Text>
            </View>
          ) : null}

          {onEdit ? (
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                onEdit();
              }}
              hitSlop={8}
              style={[
                styles.editBtn,
                { backgroundColor: dark ? '#222' : '#f3f4f6', borderColor: colors.border },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${farm.name}`}
            >
              <Ionicons name="create-outline" size={14} color={colors.text} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Risk Metrics Section */}
      <View style={styles.riskRow}>
        {farm.risk && level ? (
          <View style={{ flex: 1 }}>
            <Text style={[styles.riskLabel, { color: colors.textMuted }]}>
              {t('farmer.landRisk')}
            </Text>
            <Text style={[styles.riskNum, { color: colors.text }]}>
              {Math.round(farm.risk.probability * 100)}%
            </Text>
            <View style={{ marginTop: 4 }}>
              <RiskBadge level={level} probability={farm.risk.probability} />
            </View>
          </View>
        ) : (
          <Text style={[styles.riskUnavailable, { color: colors.textMuted }]}>
            {t('farmer.riskUnavailable')}
          </Text>
        )}
      </View>

      {/* Ground Dryness Measurement */}
      {ground ? (
        <View style={[styles.groundRow, { borderTopColor: colors.border }]}>
          <View style={[styles.groundDot, { backgroundColor: '#0284c7' }]} />
          <Ionicons name="earth" size={13} color={colors.textMuted} />
          <Text style={[styles.groundText, { color: colors.text }]}>
            {t('farmer.groundNow', { band: t(`pdsi.${pdsiKey(ground)}` as any) })}
          </Text>
        </View>
      ) : null}

      {/* Grid Coordinates & Action Link Bar */}
      <View style={styles.footerRow}>
        <View style={styles.coordsWrap}>
          <Ionicons name="grid-outline" size={12} color={colors.textMuted} />
          <Text style={[styles.coordsText, { color: colors.textMuted }]}>
            Cell [{farm.grid_row}, {farm.grid_col}] · {farm.latitude.toFixed(2)}°N, {farm.longitude.toFixed(2)}°E
          </Text>
        </View>

        <View style={styles.quickLinks}>
          {onLocateOnGrid && (
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation?.();
                onLocateOnGrid();
              }}
              style={[styles.linkBtn, { borderColor: colors.border }]}
              accessibilityRole="button"
            >
              <Ionicons name="map-outline" size={12} color={colors.primary} />
              <Text style={[styles.linkBtnText, { color: colors.primary }]}>Grid</Text>
            </TouchableOpacity>
          )}

          {onViewYield && (
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation?.();
                onViewYield();
              }}
              style={[styles.linkBtn, { borderColor: colors.border }]}
              accessibilityRole="button"
            >
              <Ionicons name="nutrition-outline" size={12} color="#d97706" />
              <Text style={[styles.linkBtnText, { color: '#d97706' }]}>Yield</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    padding: spacing.md,
    gap: spacing.sm,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaText: {
    fontSize: 12,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  activePillText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  riskRow: {
    marginTop: 2,
  },
  riskLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  riskNum: {
    fontSize: 24,
    fontWeight: '800',
    marginTop: 1,
  },
  riskUnavailable: {
    fontSize: 12,
  },
  groundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderTopWidth: 1,
    paddingTop: spacing.xs,
  },
  groundDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  groundText: {
    fontSize: 12,
    fontWeight: '600',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
    paddingTop: 2,
  },
  coordsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  coordsText: {
    fontSize: 11,
  },
  quickLinks: {
    flexDirection: 'row',
    gap: 6,
  },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  linkBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
