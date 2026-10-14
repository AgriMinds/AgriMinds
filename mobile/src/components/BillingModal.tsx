import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '@/i18n';
import { api } from '@/services/api';
import { useSelection } from '@/state/selection';
import { radius, spacing, useTheme } from '@/theme';

interface BillingModalProps {
  visible: boolean;
  onClose: () => void;
}

export function BillingModal({ visible, onClose }: BillingModalProps) {
  const { language } = useI18n();
  const { colors, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const role = useSelection((s) => s.role);

  const [selectedPlanKey, setSelectedPlanKey] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['billing', 'plans', role],
    queryFn: () => api.plans(role),
    enabled: visible,
  });

  const chooseMutation = useMutation({
    mutationFn: () =>
      api.choosePlan(
        {
          period: 'annual',
          quantity: 1,
        },
        role,
      ),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['billing', 'plans'] });
      Alert.alert(
        'Invoice Generated',
        `Reference: ${res?.invoice?.reference ?? 'AGM-2026-INVOICE'}\n\nPlease transfer to Commercial Bank of Ethiopia (CBE) Account 1000638291047 or Telebirr 0912000001, quoting this reference.`,
        [{ text: 'OK' }],
      );
    },
    onError: (err) => {
      Alert.alert('Notice', err instanceof Error ? err.message : 'Unable to select plan');
    },
  });

  const data = query.data;

  const TIERS = [
    {
      key: 'farmer_free',
      title: 'Smallholder Farmer',
      price: 'Free',
      period: 'Forever',
      badge: 'Current Basic',
      desc: 'Free early warning advisories and plots management for local Ethiopian farmers.',
      features: ['Up to 2 registered farm plots', 'Monthly seasonal outlook', 'Standard 977 hotline access'],
      highlight: false,
    },
    {
      key: 'farmer_premium',
      title: 'Farmer Daily Premium',
      price: 'ETB 5',
      period: 'per day',
      badge: 'Micro-Billing',
      desc: 'Hyper-local weather telemetry and automated SMS drought hazard warnings.',
      features: ['Daily rainfall & PDSI alerts', 'AI Agronomic Advisor prioritisation', 'Direct Kebele DA liaison'],
      highlight: true,
    },
    {
      key: 'cooperative',
      title: 'Kebele Cooperative',
      price: 'ETB 60,000',
      period: 'per year',
      badge: 'Community',
      desc: 'Woreda agricultural union covering up to 500 smallholder members.',
      features: ['Aggregated crop yield forecasts', 'Bulk SMS advisory broadcast', 'Priority extension support'],
      highlight: false,
    },
    {
      key: 'federal_ministry',
      title: 'MoA Enterprise Desk',
      price: 'ETB 9,000,000',
      period: 'per year',
      badge: 'Executive',
      desc: 'National early warning surveillance across all 8 Choke Basin woredas.',
      features: ['Metabase BI live data streaming', 'Full watershed GIS telemetry', 'Ministerial policy dashboard'],
      highlight: false,
    },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View
          style={[
            styles.container,
            {
              backgroundColor: colors.surface,
              paddingTop: Math.max(insets.top, spacing.md),
              paddingBottom: Math.max(insets.bottom, spacing.md),
            },
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <View style={styles.badgeRow}>
                <Ionicons name="card-outline" size={14} color="#f59e0b" />
                <Text style={[styles.eyebrow, { color: '#f59e0b' }]}>
                  {language === 'am' ? 'የንግድ ክፍያ እና እቅዶች' : 'Commercial Billing & Plans'}
                </Text>
              </View>
              <Text style={[styles.title, { color: colors.text }]}>
                {language === 'am' ? 'የአገልግሎት እቅዶች እና የባንክ ሒሳብ' : 'Subscription Plans & Bank Account'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close modal">
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            {/* Sovereign Bank Account Information Card */}
            <View
              style={[
                styles.bankCard,
                {
                  backgroundColor: dark ? '#261b0c' : '#fef9ee',
                  borderColor: dark ? '#593b16' : '#fde68a',
                },
              ]}
            >
              <View style={styles.bankHeader}>
                <Ionicons name="business" size={18} color="#d97706" />
                <Text style={styles.bankTitle}>Commercial Bank of Ethiopia (CBE)</Text>
              </View>

              <View style={styles.bankDetails}>
                <View style={styles.bankRow}>
                  <Text style={styles.bankLabel}>Account Name:</Text>
                  <Text style={styles.bankVal}>AgriMinds AI-DREWS Project</Text>
                </View>
                <View style={styles.bankRow}>
                  <Text style={styles.bankLabel}>CBE Account Number:</Text>
                  <Text style={[styles.bankValMono, { color: '#d97706' }]}>1000638291047</Text>
                </View>
                <View style={styles.bankRow}>
                  <Text style={styles.bankLabel}>Telebirr Merchant:</Text>
                  <Text style={[styles.bankValMono, { color: '#0284c7' }]}>0912000001</Text>
                </View>
                <View style={styles.bankRow}>
                  <Text style={styles.bankLabel}>Settlement Window:</Text>
                  <Text style={styles.bankVal}>30 Days (Direct Bank Transfer)</Text>
                </View>
              </View>

              <Text style={styles.bankNote}>
                * Payments are offline bank transfers. Please quote your generated invoice reference on your deposit slip.
              </Text>
            </View>

            {/* Current Active Plan Status */}
            {data?.current && (
              <View
                style={[
                  styles.activePlanBanner,
                  { backgroundColor: dark ? '#0c2e1c' : '#eaf8ef', borderColor: '#22c55e' },
                ]}
              >
                <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.activePlanTitle, { color: '#16a34a' }]}>
                    Active Plan: {data.current.stakeholder.replace('_', ' ').toUpperCase()}
                  </Text>
                  <Text style={[styles.activePlanSub, { color: colors.textMuted }]}>
                    Status: {data.current.status} · Billed {data.current.billing_period}
                  </Text>
                </View>
              </View>
            )}

            {/* Tier Cards */}
            <View style={styles.tiersList}>
              {TIERS.map((tier) => {
                const isSelected = selectedPlanKey === tier.key;

                return (
                  <View
                    key={tier.key}
                    style={[
                      styles.tierCard,
                      {
                        backgroundColor: colors.surfaceAlt,
                        borderColor: tier.highlight
                          ? colors.primary
                          : isSelected
                            ? '#d97706'
                            : colors.border,
                      },
                    ]}
                  >
                    <View style={styles.tierTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.tierTitle, { color: colors.text }]}>{tier.title}</Text>
                        <Text style={[styles.tierDesc, { color: colors.textMuted }]}>
                          {tier.desc}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.tierBadge,
                          {
                            backgroundColor: tier.highlight
                              ? colors.primary
                              : dark
                                ? '#222'
                                : '#e5e7eb',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.tierBadgeText,
                            { color: tier.highlight ? '#ffffff' : colors.text },
                          ]}
                        >
                          {tier.badge}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.priceRow}>
                      <Text style={[styles.priceVal, { color: colors.text }]}>{tier.price}</Text>
                      <Text style={[styles.pricePeriod, { color: colors.textMuted }]}>
                        / {tier.period}
                      </Text>
                    </View>

                    <View style={styles.features}>
                      {tier.features.map((feat, i) => (
                        <View key={i} style={styles.featItem}>
                          <Ionicons name="checkmark" size={14} color={colors.primary} />
                          <Text style={[styles.featText, { color: colors.text }]}>{feat}</Text>
                        </View>
                      ))}
                    </View>

                    {tier.key !== 'farmer_free' && (
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedPlanKey(tier.key);
                          chooseMutation.mutate();
                        }}
                        style={[
                          styles.subscribeBtn,
                          {
                            backgroundColor: tier.highlight ? colors.primary : colors.surface,
                            borderColor: colors.primary,
                          },
                        ]}
                        disabled={chooseMutation.isPending}
                      >
                        {chooseMutation.isPending && selectedPlanKey === tier.key ? (
                          <ActivityIndicator size="small" color="#ffffff" />
                        ) : (
                          <Text
                            style={[
                              styles.subscribeBtnText,
                              { color: tier.highlight ? '#ffffff' : colors.primary },
                            ]}
                          >
                            Generate Invoice & Pay
                          </Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  container: {
    height: '92%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  bankCard: {
    borderRadius: radius.md,
    borderWidth: 1.5,
    padding: spacing.md,
    gap: spacing.sm,
  },
  bankHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bankTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#d97706',
  },
  bankDetails: {
    gap: 4,
    marginTop: 2,
  },
  bankRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bankLabel: {
    fontSize: 12,
    color: 'rgba(150, 150, 150, 0.9)',
  },
  bankVal: {
    fontSize: 12,
    fontWeight: '700',
  },
  bankValMono: {
    fontSize: 13,
    fontFamily: 'monospace',
    fontWeight: '800',
  },
  bankNote: {
    fontSize: 11,
    fontStyle: 'italic',
    color: '#d97706',
    lineHeight: 15,
    marginTop: 4,
  },
  activePlanBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  activePlanTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  activePlanSub: {
    fontSize: 11,
    marginTop: 2,
  },
  tiersList: {
    gap: spacing.md,
  },
  tierCard: {
    borderRadius: radius.md,
    borderWidth: 1.5,
    padding: spacing.md,
    gap: spacing.sm,
  },
  tierTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  tierTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  tierDesc: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  tierBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  tierBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  priceVal: {
    fontSize: 22,
    fontWeight: '800',
  },
  pricePeriod: {
    fontSize: 12,
    fontWeight: '600',
  },
  features: {
    gap: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150, 150, 150, 0.2)',
    paddingTop: spacing.xs,
  },
  featItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  featText: {
    fontSize: 12,
  },
  subscribeBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: radius.sm,
    borderWidth: 1,
    marginTop: 4,
  },
  subscribeBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
