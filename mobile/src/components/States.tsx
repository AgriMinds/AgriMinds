import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useI18n } from '@/i18n';
import { radius, spacing, useTheme } from '@/theme';
import { errorMessageKey } from '@/utils/errors';

export function LoadingState() {
  const { colors } = useTheme();
  const { t } = useI18n();
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.primary} />
      <Text style={{ color: colors.textMuted, marginTop: spacing.sm }}>{t('common.loading')}</Text>
    </View>
  );
}

/** Explicit empty/error state: shown when there is neither fresh nor cached data. Never shows numbers. */
export function EmptyState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  return (
    <View style={styles.center}>
      <Text style={[styles.title, { color: colors.text }]}>{t(errorMessageKey(error))}</Text>
      <Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs }}>{t('common.noData')}</Text>
      <Pressable onPress={onRetry} style={[styles.button, { backgroundColor: colors.primary }]} accessibilityRole="button">
        <Text style={{ color: colors.onPrimary, fontWeight: '700' }}>{t('common.retry')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.xs },
  title: { fontSize: 15, fontWeight: '700', textAlign: 'center' },
  button: { marginTop: spacing.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, borderRadius: radius.md },
});
