import React from 'react';
import { StyleSheet, Text, View, type ViewProps } from 'react-native';

import { radius, spacing, type as typo, useTheme } from '@/theme';

interface CardProps extends ViewProps {
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
}

export function Card({ title, subtitle, right, children, style, ...rest }: CardProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style]} {...rest}>
      {(title || right) && (
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            {title ? <Text style={[typo.heading, { color: colors.text }]}>{title}</Text> : null}
            {subtitle ? <Text style={[typo.caption, { color: colors.textMuted, marginTop: 2 }]}>{subtitle}</Text> : null}
          </View>
          {right}
        </View>
      )}
      {children}
    </View>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return <Text style={[typo.label, { color: colors.textMuted, marginBottom: spacing.xs }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
});
