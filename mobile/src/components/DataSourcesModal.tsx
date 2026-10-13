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

interface DataSourcesModalProps {
  visible: boolean;
  onClose: () => void;
}

export function DataSourcesModal({ visible, onClose }: DataSourcesModalProps) {
  const { language } = useI18n();
  const { colors, dark } = useTheme();
  const insets = useSafeAreaInsets();

  const [expandedCitation, setExpandedCitation] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['system', 'data-sources'],
    queryFn: () => api.dataSources(),
    enabled: visible,
  });

  const data = query.data;

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
                <Ionicons name="server-outline" size={14} color={colors.primary} />
                <Text style={[styles.eyebrow, { color: colors.primary }]}>
                  {language === 'am'
                    ? 'የመሬት ምልከታ መረጃ ምንጮች'
                    : language === 'or'
                      ? 'Madda Odeeffannoo Lafaa'
                      : 'Earth Observation Feeds'}
                </Text>
              </View>
              <Text style={[styles.title, { color: colors.text }]}>
                {language === 'am' ? 'የመረጃ ምንጮች ካታሎግ' : 'Ground Data Sources'}
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
                Loading telemetry sources...
              </Text>
            </View>
          ) : query.isError ? (
            <View style={styles.centerState}>
              <Ionicons name="cloud-offline-outline" size={36} color={colors.dangerFg} />
              <Text style={[styles.stateTitle, { color: colors.dangerFg }]}>
                Unable to load data sources
              </Text>
              <Text style={[styles.stateText, { color: colors.textMuted }]}>
                {query.error instanceof Error ? query.error.message : 'Network error'}
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
              {/* Coverage Progress Card */}
              <View
                style={[
                  styles.coverageCard,
                  {
                    backgroundColor: dark ? '#0d2217' : '#ebf7f0',
                    borderColor: dark ? '#18472f' : '#bfe5cf',
                  },
                ]}
              >
                <View style={styles.coverageRow}>
                  <Text style={[styles.coverageTitle, { color: colors.text }]}>
                    {data.connected} of {data.total} Inputs Connected
                  </Text>
                  <Text style={[styles.coveragePercent, { color: colors.primary }]}>
                    {Math.round((data.connected / Math.max(data.total, 1)) * 100)}%
                  </Text>
                </View>

                {/* Multi-segment bar */}
                <View style={styles.progressBar}>
                  {Array.from({ length: data.total || 4 }).map((_, i) => (
                    <View
                      key={i}
                      style={[
                        styles.progressSegment,
                        {
                          backgroundColor:
                            i < data.connected
                              ? '#16a34a'
                              : dark
                                ? 'rgba(255, 255, 255, 0.15)'
                                : 'rgba(0, 0, 0, 0.1)',
                        },
                      ]}
                    />
                  ))}
                </View>

                {data.model_version && (
                  <Text style={[styles.modelMeta, { color: colors.textMuted }]}>
                    Model version: {data.model_version} · Issued: {data.issued_date ?? '2026-06-01'}
                  </Text>
                )}
              </View>

              {data.caveat && (
                <View style={styles.caveatBox}>
                  <Ionicons name="warning" size={16} color="#d97706" style={{ marginTop: 2 }} />
                  <Text style={styles.caveatText}>{data.caveat}</Text>
                </View>
              )}

              {/* Data Sources List */}
              <View style={styles.sourcesList}>
                {data.sources.map((source) => {
                  const isConnected = source.status === 'connected';
                  const isSynthetic = source.status === 'synthetic';
                  const isCitationOpen = expandedCitation === source.key;

                  return (
                    <View
                      key={source.key}
                      style={[
                        styles.sourceCard,
                        {
                          backgroundColor: colors.surfaceAlt,
                          borderColor: isConnected
                            ? '#22c55e'
                            : isSynthetic
                              ? '#eab308'
                              : colors.border,
                        },
                      ]}
                    >
                      <View style={styles.sourceHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.sourceName, { color: colors.text }]}>
                            {source.name}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.statusBadge,
                            {
                              backgroundColor: isConnected
                                ? dark
                                  ? '#0c2e1c'
                                  : '#dcfce7'
                                : isSynthetic
                                  ? dark
                                    ? '#2e240c'
                                    : '#fef9c3'
                                  : dark
                                    ? '#222'
                                    : '#f3f4f6',
                            },
                          ]}
                        >
                          <Ionicons
                            name={
                              isConnected
                                ? 'checkmark-circle'
                                : isSynthetic
                                  ? 'flask'
                                  : 'ellipse-outline'
                            }
                            size={12}
                            color={
                              isConnected
                                ? '#16a34a'
                                : isSynthetic
                                  ? '#ca8a04'
                                  : '#6b7280'
                            }
                          />
                          <Text
                            style={[
                              styles.statusText,
                              {
                                color: isConnected
                                  ? '#16a34a'
                                  : isSynthetic
                                    ? '#ca8a04'
                                    : '#6b7280',
                              },
                            ]}
                          >
                            {isConnected
                              ? 'Connected'
                              : isSynthetic
                                ? 'Synthetic'
                                : 'Not Connected'}
                          </Text>
                        </View>
                      </View>

                      <Text style={[styles.sourceDetail, { color: colors.textMuted }]}>
                        {source.detail}
                      </Text>

                      <View style={styles.metaRow}>
                        <View style={styles.metaCol}>
                          <Text style={[styles.metaLabel, { color: colors.textMuted }]}>
                            PROVIDER
                          </Text>
                          <Text style={[styles.metaVal, { color: colors.text }]}>
                            {source.provider}
                          </Text>
                        </View>
                        <View style={styles.metaCol}>
                          <Text style={[styles.metaLabel, { color: colors.textMuted }]}>FEEDS</Text>
                          <Text style={[styles.metaVal, { color: colors.text }]}>
                            {source.feeds}
                          </Text>
                        </View>
                      </View>

                      {source.coverage_start && source.coverage_end && (
                        <View style={styles.coverageSpan}>
                          <Text style={[styles.metaLabel, { color: colors.textMuted }]}>
                            COVERAGE
                          </Text>
                          <Text style={[styles.metaValMono, { color: colors.text }]}>
                            {source.coverage_start} → {source.coverage_end}
                          </Text>
                        </View>
                      )}

                      {source.citation && (
                        <TouchableOpacity
                          onPress={() =>
                            setExpandedCitation(isCitationOpen ? null : source.key)
                          }
                          style={styles.citationToggle}
                        >
                          <Text style={[styles.citationLabel, { color: colors.primary }]}>
                            Scientific Citation {isCitationOpen ? '▲' : '▼'}
                          </Text>
                          {isCitationOpen && (
                            <Text style={[styles.citationText, { color: colors.textMuted }]}>
                              {source.citation}
                            </Text>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </View>
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
    gap: spacing.md,
  },
  coverageCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  coverageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  coverageTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  coveragePercent: {
    fontSize: 15,
    fontWeight: '800',
  },
  progressBar: {
    flexDirection: 'row',
    gap: 4,
    height: 6,
  },
  progressSegment: {
    flex: 1,
    borderRadius: 3,
  },
  modelMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  caveatBox: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: 'rgba(217, 119, 6, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.3)',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  caveatText: {
    flex: 1,
    color: '#d97706',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  sourcesList: {
    gap: spacing.md,
  },
  sourceCard: {
    borderRadius: radius.md,
    borderWidth: 1.5,
    padding: spacing.md,
    gap: spacing.xs,
  },
  sourceHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  sourceName: {
    fontSize: 15,
    fontWeight: '700',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  sourceDetail: {
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150, 150, 150, 0.2)',
  },
  metaCol: {
    flex: 1,
    gap: 2,
  },
  coverageSpan: {
    marginTop: 4,
    gap: 2,
  },
  metaLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  metaVal: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  metaValMono: {
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  citationToggle: {
    marginTop: spacing.xs,
    paddingTop: 4,
  },
  citationLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  citationText: {
    fontSize: 11,
    fontStyle: 'italic',
    lineHeight: 16,
    marginTop: 4,
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
