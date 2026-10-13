import { Ionicons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Card } from '@/components/Card';
import { useI18n } from '@/i18n';
import { api } from '@/services/api';
import { radius, spacing, useTheme } from '@/theme';

interface Turn {
  id: string;
  from: 'farmer' | 'agent';
  text: string;
  intent?: string;
  timestamp: string;
}

const CHIPS = [
  { key: 'risk', digit: '1', labelEn: '1 · Risk', labelAm: '1 · አደጋ', labelOm: '1 · Balaa' },
  { key: 'planting', digit: '2', labelEn: '2 · Planting', labelAm: '2 · መትከል', labelOm: '2 · Dhaabuu' },
  { key: 'water', digit: '3', labelEn: '3 · Water', labelAm: '3 · ውሃ', labelOm: '3 · Bishaan' },
  { key: 'crop', digit: '4', labelEn: '4 · Crop', labelAm: '4 · ሰብል', labelOm: '4 · Midhaan' },
  { key: 'plots', digit: '5', labelEn: '5 · Plots', labelAm: '5 · ማሳ', labelOm: '5 · Qotiisa' },
  { key: 'season', digit: '6', labelEn: '6 · Season', labelAm: '6 · ወቅት', labelOm: '6 · Waggii' },
] as const;

export function AgentChat() {
  const { language } = useI18n();
  const { colors, dark } = useTheme();

  const [input, setInput] = useState('');
  const [turns, setTurns] = useState<Turn[]>([
    {
      id: 'welcome',
      from: 'agent',
      text:
        language === 'am'
          ? 'እንኳን ደህና መጡ! ስለ ማሳዎ ድርቅ፣ የመዝሪያ ጊዜ፣ ወይም የውሃ አያያዝ ይጠይቁኝ ወይም ከታች ካሉት ቁጥሮች ይጫኑ።'
          : language === 'or'
            ? "Baga nagaan dhuftan! Waa'ee balaa caamaa, yeroo facaasaa ykn bishaan qotiisa keessanii na gaafadhaa."
            : 'Welcome! Ask about drought risk, planting windows, or water conservation for your plots, or tap a topic below.',
      timestamp: 'Now',
    },
  ]);

  const scrollRef = useRef<ScrollView>(null);

  const mutation = useMutation({
    mutationFn: (text: string) =>
      api.ask({
        text,
        locale: language === 'am' ? 'am' : language === 'or' ? 'or' : 'en',
        lead_month: 1,
      }),
    onSuccess: (res) => {
      setTurns((prev) => [
        ...prev,
        {
          id: String(Date.now()),
          from: 'agent',
          text: res.text,
          intent: res.intent,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    },
    onError: (err) => {
      setTurns((prev) => [
        ...prev,
        {
          id: String(Date.now()),
          from: 'agent',
          text:
            err instanceof Error
              ? `Advisory model error: ${err.message}`
              : 'Unable to reach the advisory engine. Please verify connection.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    },
  });

  const send = (msg: string) => {
    const trimmed = msg.trim();
    if (!trimmed || mutation.isPending) return;

    setTurns((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        from: 'farmer',
        text: trimmed,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setInput('');
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    mutation.mutate(trimmed);
  };

  const getChipLabel = (chip: (typeof CHIPS)[number]) => {
    if (language === 'am') return chip.labelAm;
    if (language === 'or') return chip.labelOm;
    return chip.labelEn;
  };

  return (
    <Card
      icon={<Ionicons name="chatbubbles-outline" size={18} color={colors.primary} />}
      title={
        language === 'am'
          ? 'የአርሶ አደር AI አማካሪ (8028 Hotline)'
          : language === 'or'
            ? 'Gorsaa AI Qonnaan Bulaa (8028 Hotline)'
            : 'AI Agronomic Advisor (8028 Hotline)'
      }
      subtitle={
        language === 'am'
          ? 'ለእርስዎ ማሳ የተዘጋጀ የቀጥታ የግብርና መረጃ'
          : language === 'or'
            ? "Odeeffannoo qonnaa qotiisa keessaniif qophaa'e"
            : 'Personalized agronomic advice from your registered plots'
      }
    >
      {/* 8028 / Hotline Topic Tap Chips */}
      <View style={styles.chipsRow}>
        {CHIPS.map((chip) => (
          <Pressable
            key={chip.key}
            onPress={() => send(chip.digit)}
            style={[
              styles.chip,
              {
                backgroundColor: dark ? '#182f25' : '#e6f7ec',
                borderColor: dark ? '#24523c' : '#c3edd2',
              },
            ]}
            disabled={mutation.isPending}
          >
            <Text style={[styles.chipText, { color: colors.primary }]}>{getChipLabel(chip)}</Text>
          </Pressable>
        ))}
      </View>

      {/* Conversation Thread */}
      <ScrollView
        ref={scrollRef}
        style={styles.chatLog}
        contentContainerStyle={styles.chatLogContent}
        nestedScrollEnabled
      >
        {turns.map((turn) => {
          const isFarmer = turn.from === 'farmer';
          return (
            <View
              key={turn.id}
              style={[
                styles.bubbleWrapper,
                isFarmer ? styles.bubbleFarmerWrapper : styles.bubbleAgentWrapper,
              ]}
            >
              <View
                style={[
                  styles.bubble,
                  isFarmer
                    ? [styles.bubbleFarmer, { backgroundColor: colors.primary }]
                    : [
                        styles.bubbleAgent,
                        {
                          backgroundColor: dark ? '#1b2320' : '#f3f4f6',
                          borderColor: colors.border,
                        },
                      ],
                ]}
              >
                {!isFarmer && turn.intent && (
                  <View style={styles.intentBadge}>
                    <Ionicons name="sparkles" size={11} color="#16a34a" />
                    <Text style={styles.intentText}>{turn.intent.toUpperCase()}</Text>
                  </View>
                )}
                <Text
                  style={[
                    styles.bubbleText,
                    { color: isFarmer ? '#ffffff' : colors.text },
                  ]}
                >
                  {turn.text}
                </Text>
                <Text
                  style={[
                    styles.timeText,
                    { color: isFarmer ? 'rgba(255,255,255,0.7)' : colors.textMuted },
                  ]}
                >
                  {turn.timestamp}
                </Text>
              </View>
            </View>
          );
        })}
        {mutation.isPending && (
          <View style={styles.loadingBubble}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>
              {language === 'am'
                ? 'ምክረ ሃሳብ በማዘጋጀት ላይ...'
                : language === 'or'
                  ? 'Gorsa qopheessaa jira...'
                  : 'Analyzing plot telemetry...'}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Input Field & Send Button */}
      <View style={styles.inputRow}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder={
            language === 'am'
              ? 'ጥያቄዎን ይፃፉ ወይም ቁጥር ይምረጡ...'
              : language === 'or'
                ? 'Gaaffii keessan barreessaa...'
                : 'Ask about your plot or enter a number...'
          }
          placeholderTextColor={colors.textMuted}
          style={[
            styles.textInput,
            {
              backgroundColor: colors.surfaceAlt,
              borderColor: colors.border,
              color: colors.text,
            },
          ]}
          onSubmitEditing={() => send(input)}
          returnKeyType="send"
          editable={!mutation.isPending}
        />
        <Pressable
          onPress={() => send(input)}
          style={[
            styles.sendButton,
            { backgroundColor: input.trim() ? colors.primary : colors.surfaceAlt },
          ]}
          disabled={!input.trim() || mutation.isPending}
        >
          <Ionicons
            name="send"
            size={16}
            color={input.trim() ? '#ffffff' : colors.textMuted}
          />
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: spacing.xs,
  },
  chip: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  chatLog: {
    maxHeight: 280,
    minHeight: 140,
    borderRadius: radius.md,
    marginTop: spacing.xs,
  },
  chatLogContent: {
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  bubbleWrapper: {
    flexDirection: 'row',
    marginVertical: 2,
  },
  bubbleFarmerWrapper: {
    justifyContent: 'flex-end',
  },
  bubbleAgentWrapper: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '85%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 14,
  },
  bubbleFarmer: {
    borderBottomRightRadius: 2,
  },
  bubbleAgent: {
    borderBottomLeftRadius: 2,
    borderWidth: 1,
  },
  intentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  intentText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#16a34a',
    letterSpacing: 0.5,
  },
  bubbleText: {
    fontSize: 13,
    lineHeight: 19,
  },
  timeText: {
    fontSize: 9,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: spacing.sm,
  },
  loadingText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    height: 42,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 13,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
