import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import React from 'react';
import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LANGUAGES, useI18n, type Language } from '@/i18n';
import { useSelection, type UserRole } from '@/state/selection';
import { radius, spacing, useTheme } from '@/theme';

type IconName = keyof typeof Ionicons.glyphMap;

interface NavItem {
  id: string;
  route: string;
  titleKey: 'tabs.advisory' | 'tabs.grid' | 'tabs.enso' | 'tabs.settings';
  icon: IconName;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'advisory', route: '/(tabs)', titleKey: 'tabs.advisory', icon: 'leaf-outline' },
  { id: 'grid', route: '/(tabs)/grid', titleKey: 'tabs.grid', icon: 'grid-outline' },
  { id: 'enso', route: '/(tabs)/enso', titleKey: 'tabs.enso', icon: 'thermometer-outline' },
  { id: 'settings', route: '/(tabs)/settings', titleKey: 'tabs.settings', icon: 'settings-outline' },
];

const ROLES: { id: UserRole; icon: IconName }[] = [
  { id: 'farmer', icon: 'leaf-outline' },
  { id: 'minister', icon: 'briefcase-outline' },
  { id: 'da', icon: 'clipboard-outline' },
];

export function SidebarDrawer() {
  const { t, language, setLanguage } = useI18n();
  const { colors, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();

  const isSidebarOpen = useSelection((s) => s.isSidebarOpen);
  const setSidebarOpen = useSelection((s) => s.setSidebarOpen);
  const activeRole = useSelection((s) => s.role);
  const setRole = useSelection((s) => s.setRole);

  if (!isSidebarOpen) return null;

  const closeDrawer = () => setSidebarOpen(false);

  const handleNavigate = (route: string) => {
    closeDrawer();
    router.push(route as any);
  };

  const handleCallHotline = () => {
    Linking.openURL('tel:8028').catch(() => {});
  };

  return (
    <Modal visible={isSidebarOpen} transparent animationType="fade" onRequestClose={closeDrawer}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={closeDrawer} />

        <View
          style={[
            styles.drawerContent,
            {
              backgroundColor: colors.surface,
              paddingTop: insets.top,
              paddingBottom: Math.max(insets.bottom, spacing.md),
              borderRightColor: colors.border,
            },
          ]}
        >
          {/* Sovereign Ethiopian Tricolor Stripe */}
          <View style={styles.nationalStripe}>
            <View style={[styles.stripeSegment, { backgroundColor: '#078930' }]} />
            <View style={[styles.stripeSegment, { backgroundColor: '#FCDD09' }]} />
            <View style={[styles.stripeSegment, { backgroundColor: '#DA121A' }]} />
          </View>

          {/* Top Ethiopian Ministry Branding Header */}
          <View style={[styles.headerContainer, { borderBottomColor: colors.border }]}>
            <View style={styles.emblemRow}>
              <View style={[styles.emblemBadge, { backgroundColor: colors.primary }]}>
                <Ionicons name="shield-checkmark" size={20} color={colors.onPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.orgName, { color: colors.primary }]}>
                  {t('organization')}
                </Text>
                <Text style={[styles.appName, { color: colors.text }]}>
                  {t('appName')}
                </Text>
              </View>
              <TouchableOpacity onPress={closeDrawer} style={styles.closeBtn} accessibilityLabel="Close menu">
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={[styles.badgePill, { backgroundColor: colors.surfaceAlt }]}>
              <Ionicons name="location" size={12} color={colors.primary} />
              <Text style={[styles.badgeText, { color: colors.text }]}>
                {t('sidebar.ethiopiaBadge')}
              </Text>
            </View>
          </View>

          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            {/* Role Switcher Section (Farmer / Agricultural Minister / DA) */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
                {t('sidebar.switchRole')}
              </Text>

              <View style={styles.roleList}>
                {ROLES.map((r) => {
                  const isActive = activeRole === r.id;
                  return (
                    <TouchableOpacity
                      key={r.id}
                      onPress={() => {
                        setRole(r.id);
                        handleNavigate('/(tabs)');
                      }}
                      style={[
                        styles.roleCard,
                        {
                          backgroundColor: isActive ? colors.primary : colors.surfaceAlt,
                          borderColor: isActive ? colors.primary : colors.border,
                        },
                      ]}
                      accessibilityRole="button"
                    >
                      <View style={styles.roleCardTop}>
                        <Ionicons
                          name={r.icon}
                          size={18}
                          color={isActive ? colors.onPrimary : colors.primary}
                        />
                        <Text
                          style={[
                            styles.roleTitle,
                            { color: isActive ? colors.onPrimary : colors.text },
                          ]}
                        >
                          {t(`roles.${r.id}`)}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.roleDesc,
                          { color: isActive ? colors.accent : colors.textMuted },
                        ]}
                        numberOfLines={2}
                      >
                        {t(`roles.${r.id}Desc`)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Role-Specific Directives & Extension Toolkits */}
            {activeRole === 'farmer' && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
                  {t('sidebar.quickActions')}
                </Text>
                {/* 8028 Toll-Free Agronomic Advisory Hotline */}
                <TouchableOpacity
                  onPress={handleCallHotline}
                  style={[
                    styles.actionCard,
                    {
                      backgroundColor: dark ? '#13281b' : '#e6f7ec',
                      borderColor: colors.primary,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Call 8028 Agronomic Hotline"
                >
                  <View style={[styles.actionIconBadge, { backgroundColor: colors.primary }]}>
                    <Ionicons name="call" size={16} color={colors.onPrimary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.actionTitle, { color: colors.primary }]}>
                      {t('sidebar.hotline8028')}
                    </Text>
                    <Text style={[styles.actionSubtitle, { color: colors.textMuted }]}>
                      {t('sidebar.hotlineDesc')}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.primary} />
                </TouchableOpacity>

                {/* Local Kebele DA Extension Liaison */}
                <View
                  style={[
                    styles.actionCard,
                    {
                      backgroundColor: colors.surfaceAlt,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View style={[styles.actionIconBadge, { backgroundColor: colors.surface }]}>
                    <Ionicons name="people-outline" size={16} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.actionTitle, { color: colors.text }]}>
                      {t('sidebar.kebeleExtension')}
                    </Text>
                    <Text style={[styles.actionSubtitle, { color: colors.textMuted }]}>
                      {t('sidebar.kebeleDesc')}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {activeRole === 'minister' && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
                  {t('sidebar.quickActions')}
                </Text>
                {/* Ministerial Emergency Drought Buffer Trigger */}
                <View
                  style={[
                    styles.actionCard,
                    {
                      backgroundColor: dark ? '#2a1a10' : '#fff4ec',
                      borderColor: '#e06d10',
                    },
                  ]}
                >
                  <View style={[styles.actionIconBadge, { backgroundColor: '#e06d10' }]}>
                    <Ionicons name="warning" size={16} color="#ffffff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.actionTitle, { color: '#e06d10' }]}>
                      {t('sidebar.emergencyBuffer')}
                    </Text>
                    <Text style={[styles.actionSubtitle, { color: colors.textMuted }]}>
                      {t('sidebar.emergencyBufferDesc')}
                    </Text>
                  </View>
                </View>

                {/* Strategic Food Security Protection */}
                <View
                  style={[
                    styles.actionCard,
                    {
                      backgroundColor: colors.surfaceAlt,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View style={[styles.actionIconBadge, { backgroundColor: colors.surface }]}>
                    <Ionicons name="nutrition-outline" size={16} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.actionTitle, { color: colors.text }]}>
                      {t('sidebar.foodSecurity')}
                    </Text>
                    <Text style={[styles.actionSubtitle, { color: colors.textMuted }]}>
                      {t('sidebar.foodSecurityDesc')}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Navigation Menu */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
                {t('sidebar.menu')}
              </Text>

              <View style={styles.navList}>
                {NAV_ITEMS.map((item) => {
                  const isActive =
                    pathname === item.route ||
                    (item.route === '/(tabs)' && (pathname === '/' || pathname === '/(tabs)/index'));

                  return (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() => handleNavigate(item.route)}
                      style={[
                        styles.navItem,
                        {
                          backgroundColor: isActive
                            ? dark
                              ? colors.surfaceAlt
                              : '#e2f0e6'
                            : 'transparent',
                        },
                      ]}
                    >
                      <Ionicons
                        name={item.icon}
                        size={20}
                        color={isActive ? colors.primary : colors.textMuted}
                      />
                      <Text
                        style={[
                          styles.navText,
                          {
                            color: isActive ? colors.primary : colors.text,
                            fontWeight: isActive ? '700' : '500',
                          },
                        ]}
                      >
                        {t(item.titleKey)}
                      </Text>
                      {isActive ? (
                        <Ionicons name="chevron-forward" size={16} color={colors.primary} />
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Language Quick Switcher (English, Amharic, Afaan Oromoo) */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
                {t('settings.language')}
              </Text>
              <View style={styles.langRow}>
                {LANGUAGES.map((l) => (
                  <TouchableOpacity
                    key={l.code}
                    onPress={() => setLanguage(l.code as Language)}
                    style={[
                      styles.langBtn,
                      {
                        backgroundColor:
                          language === l.code ? colors.primary : colors.surfaceAlt,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: language === l.code ? colors.onPrimary : colors.text,
                        fontWeight: '700',
                        fontSize: 12,
                      }}
                    >
                      {l.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>

          {/* Footer Info */}
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <Text style={[styles.footerText, { color: colors.textMuted }]}>
              {t('sidebar.systemInfo')}
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  backdrop: {
    flex: 1,
  },
  drawerContent: {
    width: '84%',
    maxWidth: 330,
    height: '100%',
    borderRightWidth: 1,
  },
  nationalStripe: {
    flexDirection: 'row',
    height: 4,
    width: '100%',
  },
  stripeSegment: {
    flex: 1,
    height: 4,
  },
  headerContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    gap: spacing.sm,
  },
  emblemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  emblemBadge: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orgName: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  appName: {
    fontSize: 15,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 6,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  scrollArea: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  section: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  roleList: {
    gap: spacing.xs,
  },
  roleCard: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 4,
  },
  roleCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  roleTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  roleDesc: {
    fontSize: 11,
    lineHeight: 15,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
    marginBottom: 6,
  },
  actionIconBadge: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  actionSubtitle: {
    fontSize: 10,
    lineHeight: 13,
  },
  navList: {
    gap: 4,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    gap: spacing.md,
  },
  navText: {
    flex: 1,
    fontSize: 14,
  },
  langRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  langBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 11,
  },
});
