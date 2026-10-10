import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import React from 'react';
import {
  Image,
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

import { useFarmerDashboard } from '@/features/useFarmer';
import { LANGUAGES, useI18n, type Language } from '@/i18n';
import { useSelection, type UserRole } from '@/state/selection';
import { radius, spacing } from '@/theme';

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

const ROLES: { id: UserRole; icon: IconName; titleKey: string; descKey: string }[] = [
  { id: 'farmer', icon: 'leaf-outline', titleKey: 'roles.farmer', descKey: 'roles.farmerDesc' },
  { id: 'minister', icon: 'briefcase-outline', titleKey: 'roles.minister', descKey: 'roles.ministerDesc' },
  { id: 'da', icon: 'clipboard-outline', titleKey: 'roles.da', descKey: 'roles.daDesc' },
];

export function SidebarDrawer() {
  const { t, language, setLanguage } = useI18n();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();

  const isSidebarOpen = useSelection((s) => s.isSidebarOpen);
  const setSidebarOpen = useSelection((s) => s.setSidebarOpen);
  const activeRole = useSelection((s) => s.role);
  const setRole = useSelection((s) => s.setRole);

  const farmerData = useFarmerDashboard(1).data;

  if (!isSidebarOpen) return null;

  const closeDrawer = () => setSidebarOpen(false);

  const handleNavigate = (route: string) => {
    closeDrawer();
    router.push(route as any);
  };

  const handleCallHotline = () => {
    Linking.openURL('tel:8028').catch(() => {});
  };

  // Determine active identity attributes matching Web Sidebar
  const isMinister = activeRole === 'minister';
  const isFarmer = activeRole === 'farmer';

  const userName = isMinister
    ? 'H.E. Dr. Girma Amente'
    : isFarmer
      ? farmerData?.user.full_name || 'Abebe Kebede'
      : 'Agent Hailu';

  const userInitials = isMinister ? 'GA' : isFarmer ? 'AK' : 'DA';

  const userDetail = isMinister
    ? t('sidebar.orgTitle')
    : isFarmer
      ? `${farmerData?.farms?.length ?? 2} plots · ${farmerData?.user.woreda?.name_en ?? 'Sinan'}`
      : 'Sinan Kebele Extension Unit';

  const userBadgeRole = isMinister
    ? t('sidebar.ministerDesk')
    : isFarmer
      ? t('sidebar.registeredSmallholder')
      : t('roles.da');

  const userBadgeStatus = isMinister
    ? t('sidebar.nationalOversight')
    : isFarmer
      ? t('sidebar.activeSurveillance')
      : 'Field Operations';

  return (
    <Modal visible={isSidebarOpen} transparent animationType="fade" onRequestClose={closeDrawer}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={closeDrawer} />

        <View
          style={[
            styles.drawerContent,
            {
              paddingTop: insets.top,
              paddingBottom: Math.max(insets.bottom, spacing.md),
            },
          ]}
        >
          {/* Sovereign Ethiopian Tricolor Stripe */}
          <View style={styles.nationalStripe}>
            <View style={[styles.stripeSegment, { backgroundColor: '#078930' }]} />
            <View style={[styles.stripeSegment, { backgroundColor: '#FCDD09' }]} />
            <View style={[styles.stripeSegment, { backgroundColor: '#DA121A' }]} />
          </View>

          {/* Institutional Branding Header (Matching Web Sidebar) */}
          <View style={styles.headerContainer}>
            <View style={styles.emblemRow}>
              <View style={styles.emblemBadge}>
                <Image
                  source={require('../../assets/icon.png')}
                  style={styles.headerEmblemIcon}
                  resizeMode="contain"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.orgName}>{t('sidebar.orgTitle')}</Text>
                <Text style={styles.appName}>AgriMinds <Text style={styles.appProduct}>AI-DREWS</Text></Text>
              </View>
              <TouchableOpacity onPress={closeDrawer} style={styles.closeBtn} accessibilityLabel="Close menu">
                <Ionicons name="close" size={22} color="rgba(255, 255, 255, 0.7)" />
              </TouchableOpacity>
            </View>

            {/* Ministry Subheader Box with Live Pulse */}
            <View style={styles.subHeaderBox}>
              <View style={styles.pulseDot} />
              <Text style={styles.subHeaderText} numberOfLines={1}>
                {t('sidebar.basinBadge')}
              </Text>
            </View>
          </View>

          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            {/* Signed-in User Identity Card (Matching Web Sidebar Identity.tsx) */}
            <View style={styles.identityCard}>
              <View style={styles.identityTopRow}>
                <View
                  style={[
                    styles.avatarCircle,
                    isMinister
                      ? styles.ministerAvatar
                      : isFarmer
                        ? styles.farmerAvatar
                        : styles.daAvatar,
                  ]}
                >
                  <Text style={styles.avatarInitials}>{userInitials}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.identityName} numberOfLines={1}>
                    {userName}
                  </Text>
                  <Text style={styles.identityDetail} numberOfLines={1}>
                    {userDetail}
                  </Text>
                </View>
              </View>
              <View style={styles.identityBottomRow}>
                <Text style={styles.identityRoleBadge} numberOfLines={1}>
                  {userBadgeRole}
                </Text>
                <View style={styles.identityStatusPill}>
                  <Text style={styles.identityStatusText} numberOfLines={1}>
                    {userBadgeStatus}
                  </Text>
                </View>
              </View>
            </View>

            {/* Role Switcher Section (Farmer / Agricultural Minister / DA) */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('sidebar.switchRole')}</Text>

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
                        isActive && styles.roleCardActive,
                      ]}
                      accessibilityRole="button"
                    >
                      <View style={styles.roleCardTop}>
                        <Ionicons
                          name={r.icon}
                          size={16}
                          color={isActive ? '#c8e04a' : 'rgba(255, 255, 255, 0.7)'}
                        />
                        <Text
                          style={[
                            styles.roleTitle,
                            { color: isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.85)' },
                          ]}
                        >
                          {t(r.titleKey as any)}
                        </Text>
                      </View>
                      <Text style={styles.roleDesc} numberOfLines={2}>
                        {t(r.descKey as any)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Role-Specific Directives & Extension Toolkits */}
            {isFarmer && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('sidebar.farmerSupport')}</Text>
                {/* 8028 Toll-Free Agronomic Advisory Hotline */}
                <TouchableOpacity
                  onPress={handleCallHotline}
                  style={styles.hotlineActionCard}
                  accessibilityRole="button"
                  accessibilityLabel="Call 8028 Agronomic Hotline"
                >
                  <View style={styles.hotlineIconBadge}>
                    <Ionicons name="call" size={15} color="#082519" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.hotlineTitle}>{t('sidebar.hotline8028')}</Text>
                    <Text style={styles.hotlineSubtitle}>{t('sidebar.hotlineDesc')}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#c8e04a" />
                </TouchableOpacity>

                {/* Local Kebele DA Extension Liaison */}
                <View style={styles.directiveCard}>
                  <View style={styles.directiveIconBadge}>
                    <Ionicons name="shield-checkmark" size={16} color="#b7d4b5" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.directiveTitle}>{t('sidebar.kebeleExtension')}</Text>
                    <Text style={styles.directiveSubtitle}>{t('sidebar.kebeleDesc')}</Text>
                  </View>
                </View>
              </View>
            )}

            {isMinister && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('sidebar.executiveToolkit')}</Text>
                {/* Strategic Food Security Protection */}
                <View style={styles.directiveCard}>
                  <View style={styles.directiveIconBadge}>
                    <Ionicons name="nutrition-outline" size={16} color="#c8e04a" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.directiveTitle}>{t('sidebar.foodSecurity')}</Text>
                    <Text style={styles.directiveSubtitle}>{t('sidebar.foodSecurityDesc')}</Text>
                  </View>
                </View>

                {/* Ministerial Emergency Drought Buffer Trigger */}
                <View style={styles.directiveCard}>
                  <View style={[styles.directiveIconBadge, { backgroundColor: 'rgba(239, 68, 68, 0.2)' }]}>
                    <Ionicons name="flame" size={16} color="#f87171" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.directiveTitle, { color: '#fca5a5' }]}>
                      {t('sidebar.emergencyRelief')}
                    </Text>
                    <Text style={styles.directiveSubtitle}>{t('sidebar.emergencyReliefDesc')}</Text>
                  </View>
                </View>

                {/* Basin Woredas Covered */}
                <View style={styles.directiveCard}>
                  <View style={styles.directiveIconBadge}>
                    <Ionicons name="map-outline" size={16} color="#38bdf8" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.directiveTitle}>{t('sidebar.woredasCovered')}</Text>
                    <Text style={styles.directiveSubtitle}>{t('sidebar.woredasDesc')}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Navigation Menu */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('sidebar.menu')}</Text>

              <View style={styles.navList}>
                {NAV_ITEMS.map((item) => {
                  const isActive =
                    pathname === item.route ||
                    (item.route === '/(tabs)' && (pathname === '/' || pathname === '/(tabs)/index'));

                  return (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() => handleNavigate(item.route)}
                      style={[styles.navItem, isActive && styles.navItemActive]}
                    >
                      {isActive && <View style={styles.navActiveIndicator} />}
                      <Ionicons
                        name={item.icon}
                        size={19}
                        color={isActive ? '#c8e04a' : 'rgba(255, 255, 255, 0.65)'}
                      />
                      <Text
                        style={[
                          styles.navText,
                          {
                            color: isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.8)',
                            fontWeight: isActive ? '700' : '500',
                          },
                        ]}
                      >
                        {t(item.titleKey)}
                      </Text>
                      {isActive && (
                        <Ionicons name="chevron-forward" size={14} color="#c8e04a" />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* AI-DREWS Superhybrid-0.2.0 Model Card (Matching Web ModelCard.tsx) */}
            <View style={styles.section}>
              <View style={styles.modelCard}>
                <View style={styles.modelCardHeader}>
                  <Text style={styles.modelCardTitle}>{t('sidebar.modelTitle')}</Text>
                  <View style={styles.modelStatusDot} />
                </View>

                <View style={styles.modelRow}>
                  <Text style={styles.modelLabel}>{t('sidebar.modelVersion')}</Text>
                  <Text style={styles.modelValue}>superhybrid-0.2.0</Text>
                </View>
                <View style={styles.modelRow}>
                  <Text style={styles.modelLabel}>{t('sidebar.modelData')}</Text>
                  <Text style={styles.modelValue}>{t('sidebar.modelReal')}</Text>
                </View>
                <View style={styles.modelRow}>
                  <Text style={styles.modelLabel}>{t('sidebar.modelIssued')}</Text>
                  <Text style={styles.modelValue}>2026-06-01</Text>
                </View>

                <View style={styles.modelFooter}>
                  <Text style={styles.modelValidationText}>{t('sidebar.modelValidation')}</Text>
                  <Text style={{ color: '#c8e04a', fontSize: 11 }}>→</Text>
                </View>
              </View>
            </View>

            {/* Language Quick Switcher (English, Amharic, Afaan Oromoo) */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('settings.language')}</Text>
              <View style={styles.langColumn}>
                {LANGUAGES.map((l) => {
                  const isSelected = language === l.code;
                  return (
                    <TouchableOpacity
                      key={l.code}
                      onPress={() => setLanguage(l.code as Language)}
                      style={[styles.langBtn, isSelected && styles.langBtnActive]}
                    >
                      <Text
                        style={{
                          color: isSelected ? '#082519' : 'rgba(255, 255, 255, 0.85)',
                          fontWeight: isSelected ? '700' : '500',
                          fontSize: 13,
                        }}
                      >
                        {l.label}
                      </Text>
                      {isSelected && <Text style={{ color: '#082519', fontWeight: '800' }}>✓</Text>}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          {/* Institutional Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>{t('sidebar.systemInfo')}</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  backdrop: {
    flex: 1,
  },
  drawerContent: {
    width: '85%',
    maxWidth: 320,
    height: '100%',
    backgroundColor: '#082519', // Sovereign Ethiopian Deep Forest Green
    borderRightWidth: 1,
    borderRightColor: 'rgba(255, 255, 255, 0.12)',
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
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
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
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  headerEmblemIcon: {
    width: 32,
    height: 32,
  },
  orgName: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: '#b7d4b5', // Brand sage
  },
  appName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
  },
  appProduct: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: '#c8e04a', // Brand lime
  },
  closeBtn: {
    padding: 6,
  },
  subHeaderBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  subHeaderText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.75)',
  },
  scrollArea: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  identityCard: {
    marginTop: spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 10,
    gap: 8,
  },
  identityTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ministerAvatar: {
    backgroundColor: '#d97706',
    borderWidth: 2,
    borderColor: 'rgba(251, 191, 36, 0.5)',
  },
  farmerAvatar: {
    backgroundColor: 'rgba(183, 212, 181, 0.25)',
    borderWidth: 1.5,
    borderColor: '#c8e04a',
  },
  daAvatar: {
    backgroundColor: '#b45309',
    borderWidth: 1.5,
    borderColor: '#fbbf24',
  },
  avatarInitials: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },
  identityName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  identityDetail: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.65)',
    marginTop: 1,
  },
  identityBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingTop: 6,
  },
  identityRoleBadge: {
    fontSize: 10,
    fontWeight: '600',
    color: '#b7d4b5',
    flex: 1,
  },
  identityStatusPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  identityStatusText: {
    fontSize: 9,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  section: {
    marginTop: spacing.md,
    gap: 6,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'rgba(255, 255, 255, 0.45)',
    marginBottom: 2,
    paddingHorizontal: 4,
  },
  roleList: {
    gap: 6,
  },
  roleCard: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 8,
    padding: 9,
    gap: 3,
  },
  roleCardActive: {
    backgroundColor: 'rgba(200, 224, 74, 0.12)',
    borderColor: '#c8e04a',
  },
  roleCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  roleTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  roleDesc: {
    fontSize: 10,
    lineHeight: 13,
    color: 'rgba(255, 255, 255, 0.55)',
  },
  hotlineActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(200, 224, 74, 0.4)',
    backgroundColor: 'rgba(200, 224, 74, 0.1)',
    gap: 8,
  },
  hotlineIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#c8e04a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hotlineTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },
  hotlineSubtitle: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.65)',
  },
  directiveCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    gap: 8,
  },
  directiveIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  directiveTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  directiveSubtitle: {
    fontSize: 9.5,
    lineHeight: 13,
    color: 'rgba(255, 255, 255, 0.55)',
  },
  navList: {
    gap: 2,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
    gap: 10,
    position: 'relative',
  },
  navItemActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
  },
  navActiveIndicator: {
    position: 'absolute',
    left: 0,
    top: 6,
    bottom: 6,
    width: 3,
    borderRadius: 2,
    backgroundColor: '#c8e04a',
  },
  navText: {
    flex: 1,
    fontSize: 13,
  },
  modelCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 10,
    gap: 5,
  },
  modelCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  modelCardTitle: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#b7d4b5',
  },
  modelStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10b981',
  },
  modelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modelLabel: {
    fontSize: 10.5,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  modelValue: {
    fontSize: 10.5,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.85)',
  },
  modelFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingTop: 6,
    marginTop: 4,
  },
  modelValidationText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#c8e04a',
  },
  langColumn: {
    gap: 5,
  },
  langBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  langBtnActive: {
    backgroundColor: '#c8e04a',
    borderColor: '#c8e04a',
  },
  footer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.45)',
    textAlign: 'center',
  },
});
