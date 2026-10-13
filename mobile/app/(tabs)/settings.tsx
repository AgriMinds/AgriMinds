import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Card, Label } from '@/components/Card';
import { KeyValue } from '@/components/KeyValue';
import { Screen } from '@/components/Screen';
import { SegmentedControl } from '@/components/SegmentedControl';
import { useHealth } from '@/features/useHealth';
import { LANGUAGES, useI18n, type Language } from '@/i18n';
import {
  defaultApiBaseUrl,
  EMULATOR_API_URL,
  LOCAL_LAN_API_URL,
  RAILWAY_API_URL,
  resetApiConfigCache,
} from '@/services/config';
import { clearQueryCache, loadApiBaseUrl, loadApiKey, saveApiBaseUrl, saveApiKey } from '@/storage/preferences';
import { radius, spacing, useTheme } from '@/theme';

export default function SettingsScreen() {
  const { t, language, setLanguage } = useI18n();
  const { colors, dark } = useTheme();
  const qc = useQueryClient();
  const health = useHealth();

  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [saved, setSaved] = useState(false);
  const [testingPing, setTestingPing] = useState(false);
  const [pingResult, setPingResult] = useState<{ ok: boolean; latencyMs?: number; message?: string } | null>(null);

  useEffect(() => {
    loadApiBaseUrl().then((v) => setUrl(v ?? ''));
    loadApiKey().then((v) => setKey(v ?? ''));
  }, []);

  const activeUrl = url.trim() || defaultApiBaseUrl();

  const apply = async (nextUrl: string, nextKey: string) => {
    await Promise.all([saveApiBaseUrl(nextUrl || null), saveApiKey(nextKey || null)]);
    resetApiConfigCache();
    await qc.invalidateQueries();
    setSaved(true);
    setPingResult(null);
    health.refetch();
    setTimeout(() => setSaved(false), 2000);
  };

  const testConnection = async (targetUrl?: string) => {
    const endpoint = (targetUrl ?? activeUrl).replace(/\/+$/, '');
    setTestingPing(true);
    setPingResult(null);
    const start = Date.now();
    try {
      const res = await fetch(`${endpoint}/health`, {
        headers: { Accept: 'application/json' },
      });
      const latency = Date.now() - start;
      if (res.ok) {
        setPingResult({ ok: true, latencyMs: latency, message: `Connected (${latency} ms)` });
      } else {
        setPingResult({ ok: false, message: `Server error: HTTP ${res.status}` });
      }
    } catch (err) {
      setPingResult({
        ok: false,
        message: err instanceof Error ? err.message : 'Network request failed',
      });
    } finally {
      setTestingPing(false);
    }
  };

  const inputStyle = [styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surfaceAlt }];
  const h = health.data;

  const isRailway = activeUrl === RAILWAY_API_URL;
  const isLocal = activeUrl === LOCAL_LAN_API_URL;
  const isEmulator = activeUrl === EMULATOR_API_URL;

  return (
    <Screen title={t('settings.title')}>
      {/* Language Switcher */}
      <Card>
        <Label>{t('settings.language')}</Label>
        <SegmentedControl<Language>
          options={LANGUAGES.map((l) => ({ value: l.code, label: l.label }))}
          value={language}
          onChange={setLanguage}
        />
      </Card>

      {/* API Connection & Presets */}
      <Card title={t('settings.apiUrl')}>
        {/* Active Target Banner */}
        <View
          style={[
            styles.statusBanner,
            {
              backgroundColor: h ? (dark ? '#0c2e1c' : '#e6f7ec') : dark ? '#2e1414' : '#fdeded',
              borderColor: h ? '#22c55e' : '#ef4444',
            },
          ]}
        >
          <Ionicons
            name={h ? 'checkmark-circle' : 'alert-circle'}
            size={18}
            color={h ? '#16a34a' : '#dc2626'}
          />
          <View style={{ flex: 1 }}>
            <Text style={[styles.statusBannerTitle, { color: h ? '#16a34a' : '#dc2626' }]}>
              {h ? 'Backend Connected' : 'Server Unreachable'}
            </Text>
            <Text style={[styles.statusBannerSub, { color: colors.textMuted }]} numberOfLines={1}>
              {activeUrl}
            </Text>
          </View>
        </View>

        {/* Quick Presets */}
        <Label>Quick Presets</Label>
        <View style={styles.presetsRow}>
          <Pressable
            onPress={() => {
              setUrl(RAILWAY_API_URL);
              void apply(RAILWAY_API_URL, key);
            }}
            style={[
              styles.presetChip,
              {
                backgroundColor: isRailway ? colors.primary : colors.surfaceAlt,
                borderColor: isRailway ? colors.primary : colors.border,
              },
            ]}
          >
            <Ionicons name="cloud" size={13} color={isRailway ? '#ffffff' : colors.text} />
            <Text
              style={[
                styles.presetChipText,
                { color: isRailway ? '#ffffff' : colors.text, fontWeight: isRailway ? '700' : '500' },
              ]}
            >
              Railway Cloud
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              setUrl(LOCAL_LAN_API_URL);
              void apply(LOCAL_LAN_API_URL, key);
            }}
            style={[
              styles.presetChip,
              {
                backgroundColor: isLocal ? colors.primary : colors.surfaceAlt,
                borderColor: isLocal ? colors.primary : colors.border,
              },
            ]}
          >
            <Ionicons name="wifi" size={13} color={isLocal ? '#ffffff' : colors.text} />
            <Text
              style={[
                styles.presetChipText,
                { color: isLocal ? '#ffffff' : colors.text, fontWeight: isLocal ? '700' : '500' },
              ]}
            >
              Local Wi-Fi
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              setUrl(EMULATOR_API_URL);
              void apply(EMULATOR_API_URL, key);
            }}
            style={[
              styles.presetChip,
              {
                backgroundColor: isEmulator ? colors.primary : colors.surfaceAlt,
                borderColor: isEmulator ? colors.primary : colors.border,
              },
            ]}
          >
            <Ionicons name="laptop" size={13} color={isEmulator ? '#ffffff' : colors.text} />
            <Text
              style={[
                styles.presetChipText,
                { color: isEmulator ? '#ffffff' : colors.text, fontWeight: isEmulator ? '700' : '500' },
              ]}
            >
              Emulator
            </Text>
          </Pressable>
        </View>

        {/* Custom URL Input */}
        <Label>{t('settings.apiUrl')}</Label>
        <TextInput
          value={url}
          onChangeText={setUrl}
          placeholder={defaultApiBaseUrl()}
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          style={inputStyle}
        />
        <Text style={{ color: colors.textMuted, fontSize: 11 }}>{t('settings.apiUrlHint')}</Text>

        <Label>{t('settings.apiKey')}</Label>
        <TextInput
          value={key}
          onChangeText={setKey}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          style={inputStyle}
        />
        <Text style={{ color: colors.textMuted, fontSize: 11 }}>{t('settings.apiKeyHint')}</Text>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <Pressable
            onPress={() => apply(url, key)}
            style={[styles.button, { backgroundColor: colors.primary }]}
            accessibilityRole="button"
          >
            <Text style={{ color: colors.onPrimary, fontWeight: '700' }}>
              {saved ? t('settings.saved') : t('settings.save')}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => testConnection()}
            style={[styles.button, { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border }]}
            accessibilityRole="button"
            disabled={testingPing}
          >
            {testingPing ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={{ color: colors.text, fontWeight: '700' }}>Test Ping</Text>
            )}
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
            <Text style={{ color: colors.textMuted, fontWeight: '700' }}>{t('settings.reset')}</Text>
          </Pressable>
        </View>

        {/* Ping Result Feedback */}
        {pingResult && (
          <View
            style={[
              styles.pingFeedback,
              {
                backgroundColor: pingResult.ok ? (dark ? '#0c2e1c' : '#e6f7ec') : dark ? '#2e1414' : '#fdeded',
                borderColor: pingResult.ok ? '#22c55e' : '#ef4444',
              },
            ]}
          >
            <Ionicons
              name={pingResult.ok ? 'checkmark-circle' : 'close-circle'}
              size={16}
              color={pingResult.ok ? '#16a34a' : '#dc2626'}
            />
            <Text style={{ color: pingResult.ok ? '#16a34a' : '#dc2626', fontSize: 12, fontWeight: '600', flex: 1 }}>
              {pingResult.message}
            </Text>
          </View>
        )}
      </Card>

      {/* Health & Diagnostic Overview */}
      <Card title={t('settings.health')}>
        {h ? (
          <View style={{ gap: spacing.xs }}>
            <KeyValue label="status" value={h.status} />
            <KeyValue label="service" value={h.service ?? 'AgriMinds AI-DREWS'} />
            <KeyValue label="version" value={h.version} />
            <KeyValue label="environment" value={h.environment ?? 'production'} />
            <KeyValue label="model" value={h.model.model_version ?? h.model.source} />
            <KeyValue label="model data" value={h.model.data_source ?? '—'} />
            <KeyValue label="auth" value={h.auth_enabled ? 'on' : 'off'} />
            <KeyValue label="cache" value={h.cache?.backend ?? 'memory'} />
            <KeyValue label="database" value={h.database?.reachable ? 'connected' : 'offline'} />
          </View>
        ) : (
          <Text style={{ color: colors.textMuted }}>
            {health.isPending ? t('common.loading') : `${t('common.offline')} — could not reach ${activeUrl}`}
          </Text>
        )}
        <Pressable
          onPress={() => health.refetch()}
          style={[styles.button, { backgroundColor: colors.surfaceAlt, marginTop: spacing.sm }]}
          accessibilityRole="button"
        >
          <Text style={{ color: colors.text, fontWeight: '700' }}>{t('common.retry')}</Text>
        </Pressable>
      </Card>

      {/* Cache & App Data */}
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
        <Text style={{ color: colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: spacing.xs }}>
          {t('settings.about')}
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
  },
  actions: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs },
  button: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.md, justifyContent: 'center' },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.xs,
  },
  statusBannerTitle: { fontSize: 13, fontWeight: '700' },
  statusBannerSub: { fontSize: 11, marginTop: 1 },
  presetsRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.xs },
  presetChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  presetChipText: { fontSize: 11 },
  pingFeedback: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    marginTop: spacing.xs,
  },
});
