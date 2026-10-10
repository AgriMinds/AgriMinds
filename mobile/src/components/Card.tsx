import React from 'react';
import { StyleSheet, Text, View, type ViewProps } from 'react-native';

import { radius, spacing, type as typo, useTheme } from '@/theme';

interface CardProps extends ViewProps {
  icon?: React.ReactNode;
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
}

export function Card({ icon, title, subtitle, right, children, style, ...rest }: CardProps) {
  const { colors, dark } = useTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          shadowColor: dark ? '#000000' : '#0e3d30',
        },
        style,
      ]}
      {...rest}
    >
      {(title || right || icon) && (
        <View style={styles.header}>
          {icon ? (
            <View
              style={[
                styles.cardIconBox,
                {
                  backgroundColor: dark ? '#13281b' : '#e6f7ec',
                },
              ]}
            >
              {icon}
            </View>
          ) : null}
          <View style={{ flex: 1, minWidth: 0 }}>
            {title ? (
              <Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text>
            ) : null}
            {subtitle ? (
              <Text style={[styles.cardSubtitle, { color: colors.textMuted }]}>
                {subtitle}
              </Text>
            ) : null}
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
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  cardIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  cardSubtitle: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
});
