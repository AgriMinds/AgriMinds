import { useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Card, Label } from '@/components/Card';
import { KeyValue } from '@/components/KeyValue';
import { Screen } from '@/components/Screen';
import { SegmentedControl } from '@/components/SegmentedControl';
import { useHealth } from '@/features/useHealth';
import { LANGUAGES, useI18n, type Language } from '@/i18n';
import { defaultApiBaseUrl, resetApiConfigCache } from '@/services/config';
import { clearQueryCache, loadApiBaseUrl, loadApiKey, saveApiBaseUrl, saveApiKey } from '@/storage/preferences';
import { radius, spacing, useTheme } from '@/theme';

export default function SettingsScreen() {
  const { t, language, setLanguage } = useI18n();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const health = useHealth();
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadApiBaseUrl().then((v) => setUrl(v ?? ''));
    loadApiKey().then((v) => setKey(v ?? ''));
  }, []);

  const apply = async (nextUrl: string, nextKey: string) => {
    await Promise.all([saveApiBaseUrl(nextUrl || null), saveApiKey(nextKey || null)]);
    resetApiConfigCache();
    await qc.invalidateQueries();
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const inputStyle = [styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surfaceAlt }];
  const h = health.data;

  return (
    <Screen title={t('settings.title')}>
      <Card>
        <Label>{t('settings.language')}</Label>
        <SegmentedControl<Language> options={LANGUAGES.map((l) => ({ value: l.code, label: l.label }))} value={language} onChange={setLanguage} />
      </Card>
      <Card>
        <Label>{t('settings.apiUrl')}</Label>
        <TextInput value={url} onChangeText={setUrl} placeholder={defaultApiBaseUrl()} placeholderTextColor={colors.textMuted} autoCapitalize="none" autoCorrect={false} keyboardType="url" style={inputStyle} />
        <Text style={{ color: colors.textMuted, fontSize: 11 }}>{t('settings.apiUrlHint')}</Text>
        <Label>{t('settings.apiKey')}</Label>
        <TextInput value={key} onChangeText={setKey} secureTextEntry autoCapitalize="none" autoCorrect={false} style={inputStyle} />
        <Text style={{ color: colors.textMuted, fontSize: 11 }}>{t('settings.apiKeyHint')}</Text>
        <View style={styles.actions}>
          <Pressable onPress={() => apply(url, key)} style={[styles.button, { backgroundColor: colors.primary }]} accessibilityRole="button">
            <Text style={{ color: colors.onPrimary, fontWeight: '700' }}>{saved ? t('settings.saved') : t('settings.save')}</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setUrl('');
              setKey('');
              void apply('', '');
            }}
            style={[styles.button, { backgroundColor: colors.surfaceAlt }]}
            accessibilityRole="button"
          >
            <Text style={{ color: colors.text, fontWeight: '700' }}>{t('settings.reset')}</Text>
          </Pressable>
        </View>
      </Card>
      <Card title={t('settings.health')}>
        {h ? (
          <View style={{ gap: spacing.xs }}>
            <KeyValue label="status" value={h.status} />
            <KeyValue label="version" value={h.version} />
            <KeyValue label="model" value={h.model.model_version ?? h.model.source} />
            <KeyValue label="data" value={h.model.data_source ?? '—'} />
            <KeyValue label="auth" value={h.auth_enabled ? 'on' : 'off'} />
          </View>
        ) : (
          <Text style={{ color: colors.textMuted }}>{health.isPending ? t('common.loading') : t('common.offline')}</Text>
        )}
        <Pressable onPress={() => health.refetch()} style={[styles.button, { backgroundColor: colors.surfaceAlt }]} accessibilityRole="button">
          <Text style={{ color: colors.text, fontWeight: '700' }}>{t('common.retry')}</Text>
        </Pressable>
      </Card>
      <Card>
        <Pressable
          onPress={async () => {
            await clearQueryCache();
            qc.clear();
          }}
          style={[styles.button, { backgroundColor: colors.dangerBg }]}
          accessibilityRole="button"
        >
          <Text style={{ color: colors.dangerFg, fontWeight: '700' }}>{t('settings.clearCache')}</Text>
        </Pressable>
        <Text style={{ color: colors.textMuted, fontSize: 11, textAlign: 'center' }}>{t('settings.about')}</Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: 14 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  button: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.md },
});
