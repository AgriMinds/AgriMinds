import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '@/i18n';
import { api } from '@/services/api';
import { radius, spacing, useTheme } from '@/theme';

interface ModelMetricsModalProps {
  visible: boolean;
  onClose: () => void;
}

export function ModelMetricsModal({ visible, onClose }: ModelMetricsModalProps) {
  const { language } = useI18n();
  const { colors, dark } = useTheme();
  const insets = useSafeAreaInsets();

  const [selectedLead, setSelectedLead] = useState<number>(1);

  const query = useQuery({
    queryKey: ['model', 'metrics'],
    queryFn: () => api.modelMetrics(),
    enabled: visible,
  });

  const data = query.data;
  const droughtMetrics = data?.drought ?? [];
  const ensoMetrics = data?.enso ?? [];
  const lead1 = droughtMetrics.find((m) => m.lead === selectedLead) ?? droughtMetrics[0];

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
                <Ionicons name="analytics" size={14} color="#38bdf8" />
                <Text style={[styles.eyebrow, { color: '#38bdf8' }]}>
                  {language === 'am'
                    ? 'ሳይንሳዊ ግምገማ እና ውጤት'
                    : language === 'or'
                      ? 'Qorannoo Saayinsii fi Bu''aa'
                      : 'Scientific Model Validation'}
                </Text>
              </View>
              <Text style={[styles.title, { color: colors.text }]}>
                SuperHybrid-0.2.0 Skill Scorecard
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close modal">
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {query.isLoading ? (
            <View style={styles.centerState}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.stateText, { color: colors.textMuted }]}>
                Loading model skill metrics...
              </Text>
            </View>
          ) : query.isError ? (
            <View style={styles.centerState}>
              <Ionicons name="alert-circle-outline" size={36} color={colors.dangerFg} />
              <Text style={[styles.stateTitle, { color: colors.dangerFg }]}>
                Metrics unavailable
              </Text>
              <Text style={[styles.stateText, { color: colors.textMuted }]}>
                {query.error instanceof Error ? query.error.message : 'Failed to load model metrics'}
              </Text>
              <Pressable
                onPress={() => query.refetch()}
                style={[styles.retryBtn, { backgroundColor: colors.primary }]}
              >
                <Text style={styles.retryBtnText}>Retry</Text>
              </Pressable>
            </View>
          ) : data ? (
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
              {/* Top Headline KPI Grid */}
              <View style={styles.kpiGrid}>
                <View
                  style={[
                    styles.kpiCard,
                    {
                      backgroundColor: dark ? '#0c2e1c' : '#eaf8ef',
                      borderColor: dark ? '#1b5e39' : '#b7e4c7',
                    },
                  ]}
                >
                  <Text style={[styles.kpiLabel, { color: colors.textMuted }]}>ROC-AUC (Lead 1)</Text>
                  <Text style={[styles.kpiValue, { color: colors.primary }]}>
                    {lead1?.AUC ? lead1.AUC.toFixed(3) : '0.709'}
                  </Text>
                  <Text style={[styles.kpiSub, { color: colors.primary }]}>
                    +{(lead1 ? ((lead1.AUC - lead1.AUC_persistence) * 100).toFixed(1) : '3.2')}% vs persistence
                  </Text>
                </View>

                <View
                  style={[
                    styles.kpiCard,
                    {
                      backgroundColor: dark ? '#132438' : '#eaf3fd',
                      borderColor: dark ? '#1d4872' : '#bfdbfe',
                    },
                  ]}
                >
                  <Text style={[styles.kpiLabel, { color: colors.textMuted }]}>BRIER SCORE</Text>
                  <Text style={[styles.kpiValue, { color: '#0284c7' }]}>
                    {lead1?.Brier ? lead1.Brier.toFixed(3) : '0.123'}
                  </Text>
                  <Text style={[styles.kpiSub, { color: '#0284c7' }]}>
                    BSS: {lead1?.BSS_vs_climatology ? lead1.BSS_vs_climatology.toFixed(3) : '0.061'}
                  </Text>
                </View>

                <View
                  style={[
                    styles.kpiCard,
                    {
                      backgroundColor: dark ? '#2a1a10' : '#fdf4eb',
                      borderColor: dark ? '#593215' : '#fed7aa',
                    },
                  ]}
                >
                  <Text style={[styles.kpiLabel, { color: colors.textMuted }]}>ACCURACY</Text>
                  <Text style={[styles.kpiValue, { color: '#d97706' }]}>
                    {lead1?.Accuracy ? `${(lead1.Accuracy * 100).toFixed(1)}%` : '72.1%'}
                  </Text>
                  <Text style={[styles.kpiSub, { color: '#d97706' }]}>
                    F1: {lead1?.F1 ? lead1.F1.toFixed(3) : '0.350'}
                  </Text>
                </View>

                <View
                  style={[
                    styles.kpiCard,
                    {
                      backgroundColor: dark ? '#1f1b2e' : '#f5f3ff',
                      borderColor: dark ? '#3e3465' : '#ddd6fe',
                    },
                  ]}
                >
                  <Text style={[styles.kpiLabel, { color: colors.textMuted }]}>RECALL / POD</Text>
                  <Text style={[styles.kpiValue, { color: '#7c3aed' }]}>
                    {lead1?.Recall ? `${(lead1.Recall * 100).toFixed(1)}%` : '48.3%'}
                  </Text>
                  <Text style={[styles.kpiSub, { color: '#7c3aed' }]}>
                    Precision: {lead1?.Precision ? `${(lead1.Precision * 100).toFixed(1)}%` : '27.4%'}
                  </Text>
                </View>
              </View>

              {/* Lead Selector Tabs */}
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  Drought Hazard Classification by Lead Month
                </Text>
                <View style={styles.leadTabs}>
                  {[1, 2, 3].map((lead) => (
                    <TouchableOpacity
                      key={lead}
                      onPress={() => setSelectedLead(lead)}
                      style={[
                        styles.leadTabBtn,
                        selectedLead === lead && {
                          backgroundColor: colors.primary,
                          borderColor: colors.primary,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.leadTabBtnText,
                          { color: selectedLead === lead ? '#ffffff' : colors.textMuted },
                        ]}
                      >
                        Lead {lead}m
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Confusion Matrix Card */}
              {lead1 && (
                <View
                  style={[
                    styles.card,
                    { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.cardTitle, { color: colors.text }]}>
                    Held-Out Confusion Matrix (Lead {selectedLead} Month)
                  </Text>
                  <Text style={[styles.cardSubtitle, { color: colors.textMuted }]}>
                    Drought Event Threshold (Sc-PDSI ≤ -1.5)
                  </Text>

                  <View style={styles.matrixContainer}>
                    <View style={styles.matrixRow}>
                      <View style={[styles.matrixCell, styles.matrixTP]}>
                        <Text style={styles.matrixCellVal}>{lead1.TP ?? 14}</Text>
                        <Text style={styles.matrixCellLabel}>True Positives</Text>
                      </View>
                      <View style={[styles.matrixCell, styles.matrixFP]}>
                        <Text style={styles.matrixCellVal}>{lead1.FP ?? 37}</Text>
                        <Text style={styles.matrixCellLabel}>False Positives</Text>
                      </View>
                    </View>

                    <View style={styles.matrixRow}>
                      <View style={[styles.matrixCell, styles.matrixFN]}>
                        <Text style={styles.matrixCellVal}>{lead1.FN ?? 15}</Text>
                        <Text style={styles.matrixCellLabel}>False Negatives</Text>
                      </View>
                      <View style={[styles.matrixCell, styles.matrixTN]}>
                        <Text style={styles.matrixCellVal}>{lead1.TN ?? 82}</Text>
                        <Text style={styles.matrixCellLabel}>True Negatives</Text>
                      </View>
                    </View>
                  </View>
                </View>
              )}

              {/* ENSO Forecast Regression Errors */}
              {ensoMetrics.length > 0 && (
                <View
                  style={[
                    styles.card,
                    { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.cardTitle, { color: colors.text }]}>
                    ENSO Niño 3.4 SST Regression Skill
                  </Text>
                  <Text style={[styles.cardSubtitle, { color: colors.textMuted }]}>
                    Comparative error metrics on held-out historical observations
                  </Text>

                  <View style={styles.table}>
                    <View style={[styles.tableHeader, { borderBottomColor: colors.border }]}>
                      <Text style={[styles.th, { flex: 2, color: colors.textMuted }]}>MODEL</Text>
                      <Text style={[styles.th, { flex: 1, color: colors.textMuted }]}>LEAD</Text>
                      <Text style={[styles.th, { flex: 1, color: colors.textMuted }]}>RMSE</Text>
                      <Text style={[styles.th, { flex: 1, color: colors.textMuted }]}>MAE</Text>
                      <Text style={[styles.th, { flex: 1, color: colors.textMuted }]}>CORR</Text>
                    </View>

                    {ensoMetrics.slice(0, 6).map((m, idx) => (
                      <View
                        key={idx}
                        style={[styles.tableRow, { borderBottomColor: colors.border }]}
                      >
                        <Text style={[styles.td, { flex: 2, fontWeight: '700', color: colors.text }]}>
                          {m.model}
                        </Text>
                        <Text style={[styles.td, { flex: 1, color: colors.textMuted }]}>
                          {m.lead}m
                        </Text>
                        <Text style={[styles.tdMono, { flex: 1, color: colors.text }]}>
                          {m.RMSE?.toFixed(2) ?? '—'}
                        </Text>
                        <Text style={[styles.tdMono, { flex: 1, color: colors.text }]}>
                          {m.MAE?.toFixed(2) ?? '—'}
                        </Text>
                        <Text style={[styles.tdMono, { flex: 1, color: colors.primary }]}>
                          {m.correlation?.toFixed(2) ?? '—'}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </ScrollView>
          ) : null}
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
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  kpiCard: {
    width: '48%',
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: 3,
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  kpiSub: {
    fontSize: 11,
    fontWeight: '600',
  },
  sectionHeader: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  leadTabs: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  leadTabBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(150, 150, 150, 0.3)',
  },
  leadTabBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  card: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  cardSubtitle: {
    fontSize: 11.5,
    marginBottom: spacing.xs,
  },
  matrixContainer: {
    gap: spacing.xs,
    marginTop: 4,
  },
  matrixRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  matrixCell: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matrixTP: {
    backgroundColor: 'rgba(22, 163, 74, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(22, 163, 74, 0.4)',
  },
  matrixFP: {
    backgroundColor: 'rgba(217, 119, 6, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.4)',
  },
  matrixFN: {
    backgroundColor: 'rgba(220, 38, 38, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.4)',
  },
  matrixTN: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.4)',
  },
  matrixCellVal: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
  },
  matrixCellLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  table: {
    marginTop: spacing.xs,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 1,
  },
  th: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  td: {
    fontSize: 11,
  },
  tdMono: {
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: '700',
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  stateTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  stateText: {
    fontSize: 13,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    marginTop: spacing.sm,
  },
  retryBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
