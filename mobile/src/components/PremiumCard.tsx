import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Card } from '@/components/Card';
import { useI18n } from '@/i18n';
import { api } from '@/services/api';
import { radius, spacing, useTheme } from '@/theme';

export function PremiumCard() {
  const { language } = useI18n();
  const { colors, dark } = useTheme();
  const qc = useQueryClient();

  const [note, setNote] = useState('');
  const [expanded, setExpanded] = useState(false);

  const query = useQuery({
    queryKey: ['premium', 'my-request'],
    queryFn: () => api.myPremiumRequest(),
  });

  const request = query.data;
  const isPending = request?.status === 'new' || request?.status === 'contacted';
  const isApproved = request?.status === 'approved';

  const upgradeMutation = useMutation({
    mutationFn: (notes: string) =>
      api.requestPremium({
        message: notes.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['premium', 'my-request'] });
      setExpanded(false);
      setNote('');
    },
  });

  return (
    <Card
      icon={<Ionicons name="sparkles" size={18} color="#f59e0b" />}
      title={
        language === 'am'
          ? 'የአርሶ አደር ፕሪሚየም አገልግሎት (ETB 5 / ቀን)'
          : language === 'or'
            ? 'Tajaajila Qonnaan Bulaa Filatamaa (ETB 5 / guyyaa)'
            : 'Daily Farmer Premium (ETB 5 / day)'
      }
      subtitle={
        language === 'am'
          ? 'ያልተገደበ የኤስኤምኤስ እና የድምጽ ጥሪ የድርቅ ማስጠንቀቂያ'
          : language === 'or'
            ? 'Akeekkachiisa caamaa bilbilaa fi ergaa gabaabaa daangaa hin qabne'
            : 'Unlimited SMS & hotline alerts for your specific micro-catchment'
      }
    >
      <View
        style={[
          styles.container,
          {
            backgroundColor: dark ? '#241a0e' : '#fffbeb',
            borderColor: dark ? '#453114' : '#fde68a',
          },
        ]}
      >
        {isApproved ? (
          <View style={styles.statusRow}>
            <Ionicons name="checkmark-circle" size={20} color="#16a34a" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.statusTitle, { color: '#16a34a' }]}>
                {language === 'am'
                  ? 'ፕሪሚየም አገልግሎትዎ ጸድቋል'
                  : language === 'or'
                    ? "Tajaajilli filatamaa mirkanaa'eera"
                    : 'Premium Subscription Approved'}
              </Text>
              <Text style={[styles.statusBody, { color: colors.textMuted }]}>
                {language === 'am'
                  ? 'የኢትዮጵያ ንግድ ባንክ ወይም ቴሌብር ሒሳብ: 1000XXXXXXXXX'
                  : 'Commercial Bank of Ethiopia / Telebirr Account: 1000XXXXXXXXX'}
              </Text>
            </View>
          </View>
        ) : isPending ? (
          <View style={styles.statusRow}>
            <Ionicons name="time-outline" size={20} color="#d97706" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.statusTitle, { color: '#d97706' }]}>
                {language === 'am'
                  ? 'የማሻሻያ ጥያቄዎ በመገምገም ላይ ነው'
                  : language === 'or'
                    ? 'Gaaffiin keessan qoratamaa jira'
                    : 'Upgrade Request Under Review'}
              </Text>
              <Text style={[styles.statusBody, { color: colors.textMuted }]}>
                {language === 'am'
                  ? 'የወረዳው የልማት ጣቢያ ባለሙያ ማሳዎትን በማረጋገጥ ላይ ናቸው።'
                  : 'Development Agent is verifying your registered plot boundaries.'}
              </Text>
            </View>
          </View>
        ) : (
          <View style={{ gap: spacing.sm }}>
            <View style={styles.featureList}>
              <View style={styles.featureItem}>
                <Ionicons name="notifications" size={14} color="#f59e0b" />
                <Text style={[styles.featureText, { color: colors.text }]}>
                  {language === 'am'
                    ? 'የቀን ተቀን የዝናብ እና የድርቅ የቅድመ ማስጠንቀቂያ መልእክት'
                    : 'Daily hyper-local rainfall & Palmer Sc-PDSI early warning'}
                </Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="call" size={14} color="#f59e0b" />
                <Text style={[styles.featureText, { color: colors.text }]}>
                  {language === 'am'
                    ? 'በ 977 ነፃ መስመር የቀጥታ የባለሙያ እና AI ድጋፍ'
                    : 'Priority 977 hotline interactive agronomic AI advisory'}
                </Text>
              </View>
            </View>

            {expanded ? (
              <View style={{ gap: spacing.xs, marginTop: spacing.xs }}>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder={
                    language === 'am'
                      ? 'ተጨማሪ መረጃ (ለምሳሌ፡ የማሳ ስም፣ የቀበሌ መለያ)...'
                      : 'Optional note (e.g. plot location, Kebele)...'
                  }
                  placeholderTextColor={colors.textMuted}
                  style={[
                    styles.noteInput,
                    {
                      backgroundColor: colors.surfaceAlt,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  multiline
                />
                <View style={styles.actionRow}>
                  <Pressable
                    onPress={() => upgradeMutation.mutate(note)}
                    style={[styles.btn, { backgroundColor: colors.primary }]}
                    disabled={upgradeMutation.isPending}
                  >
                    {upgradeMutation.isPending ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={styles.btnText}>
                        {language === 'am' ? 'ጥያቄውን ላክ' : 'Submit Request'}
                      </Text>
                    )}
                  </Pressable>
                  <Pressable
                    onPress={() => setExpanded(false)}
                    style={[styles.btn, { backgroundColor: colors.surfaceAlt }]}
                  >
                    <Text style={{ color: colors.textMuted, fontWeight: '700' }}>
                      {language === 'am' ? 'ሰርዝ' : 'Cancel'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable
                onPress={() => setExpanded(true)}
                style={[styles.activateBtn, { backgroundColor: colors.primary }]}
              >
                <Ionicons name="sparkles" size={14} color="#ffffff" />
                <Text style={styles.btnText}>
                  {language === 'am' ? 'ፕሪሚየም አባልነት ይጠይቁ' : 'Request Premium Upgrade'}
                </Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    marginTop: spacing.xs,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  statusBody: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  featureList: {
    gap: 6,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  featureText: {
    fontSize: 12,
    fontWeight: '600',
  },
  activateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: radius.sm,
    marginTop: 4,
  },
  noteInput: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 12,
    minHeight: 50,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  btn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: radius.sm,
  },
  btnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
});
