import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { spacing, type as typo, useTheme } from '@/theme';

interface Props {
  title?: string;
  subtitle?: string;
  refreshing?: boolean;
  onRefresh?: () => void;
  children: React.ReactNode;
}

export function Screen({ title, subtitle, refreshing = false, onRefresh, children }: Props) {
  const { colors } = useTheme();

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined}
    >
      {title ? (
        <View style={styles.header}>
          <View style={{ gap: 2 }}>
            <Text style={[typo.title, { color: colors.text }]}>{title}</Text>
            {subtitle ? <Text style={[typo.caption, { color: colors.textMuted }]}>{subtitle}</Text> : null}
          </View>
        </View>
      ) : null}
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingTop: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  header: { marginBottom: spacing.xs },
});
