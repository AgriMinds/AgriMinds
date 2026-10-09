import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import React from 'react';
import {
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
  { id: 'farmer', icon: 'person-outline' },
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

  return (
    <Modal visible={isSidebarOpen} transparent animationType="fade" onRequestClose={closeDrawer}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={closeDrawer} />

        <View
          style={[
            styles.drawerContent,
            {
              backgroundColor: colors.surface,
              paddingTop: Math.max(insets.top, spacing.lg),
              paddingBottom: Math.max(insets.bottom, spacing.md),
              borderRightColor: colors.border,
            },
          ]}
        >
          {/* Top Ethiopian Ministry Branding Header */}
          <View style={[styles.headerContainer, { borderBottomColor: colors.border }]}>
            <View style={styles.emblemRow}>
              <View style={[styles.emblemBadge, { backgroundColor: colors.primary }]}>
                <Ionicons name="shield-checkmark" size={22} color={colors.onPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.orgName, { color: colors.primary }]}>
                  {t('organization')}
                </Text>
                <Text style={[styles.appName, { color: colors.text }]}>
                  {t('appName')}
                </Text>
              </View>
              <TouchableOpacity onPress={closeDrawer} style={styles.closeBtn}>
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
            {/* Role Switcher Section */}
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
                      onPress={() => setRole(r.id)}
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

            {/* Language Quick Switcher */}
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  backdrop: {
    flex: 1,
  },
  drawerContent: {
    width: '82%',
    maxWidth: 320,
    height: '100%',
    borderRightWidth: 1,
  },
  headerContainer: {
    paddingHorizontal: spacing.lg,
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
    width: 38,
    height: 38,
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
    padding: 4,
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
    marginTop: spacing.lg,
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
