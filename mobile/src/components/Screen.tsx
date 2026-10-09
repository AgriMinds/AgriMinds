import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '@/i18n';
import { useSelection } from '@/state/selection';
import { radius, spacing, type as typo, useTheme } from '@/theme';

interface Props {
  title: string;
  subtitle?: string;
  refreshing?: boolean;
  onRefresh?: () => void;
  children: React.ReactNode;
}

export function Screen({ title, subtitle, refreshing = false, onRefresh, children }: Props) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const role = useSelection((s) => s.role);
  const toggleSidebar = useSelection((s) => s.toggleSidebar);

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm }]}
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined}
    >
      <View style={styles.topNavRow}>
        <Pressable
          onPress={toggleSidebar}
          style={[styles.menuButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          accessibilityRole="button"
          accessibilityLabel="Open sidebar menu"
        >
          <Ionicons name="menu" size={22} color={colors.primary} />
        </Pressable>

        <Pressable
          onPress={toggleSidebar}
          style={[styles.roleBadge, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
          accessibilityRole="button"
        >
          <Ionicons name="person-circle-outline" size={16} color={colors.primary} />
          <Text style={[styles.roleBadgeText, { color: colors.text }]}>{t(`roles.${role}`)}</Text>
          <Ionicons name="chevron-down" size={12} color={colors.textMuted} />
        </Pressable>
      </View>

      <View style={styles.header}>
        <Image source={require('../../assets/icon.png')} style={styles.logo} />
        <View style={{ gap: 2 }}>
          <Text style={[typo.title, { color: colors.text }]}>{title}</Text>
          {subtitle ? <Text style={[typo.caption, { color: colors.textMuted }]}>{subtitle}</Text> : null}
        </View>
      </View>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  topNavRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
  menuButton: { padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, elevation: 1 },
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill, borderWidth: 1 },
  roleBadgeText: { fontSize: 12, fontWeight: '700' },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xs },
  logo: { width: 36, height: 36, borderRadius: 8 },
});
