import { Ionicons } from '@expo/vector-icons';
import type { ColorValue } from 'react-native';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Tabs } from 'expo-router';
import React from 'react';

import { useI18n } from '@/i18n';
import { useSelection } from '@/state/selection';
import { useTheme } from '@/theme';

type IconName = keyof typeof Ionicons.glyphMap;

function tabIcon(name: IconName) {
  function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} size={size} color={color} />;
  }
  return TabIcon;
}

export default function TabsLayout() {
  const { t } = useI18n();
  const { colors, dark } = useTheme();
  const role = useSelection((s) => s.role);
  const toggleSidebar = useSelection((s) => s.toggleSidebar);

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerLeft: () => (
          <Pressable
            onPress={toggleSidebar}
            style={styles.headerMenuBtn}
            accessibilityRole="button"
            accessibilityLabel="Open sidebar menu"
          >
            <Ionicons name="menu" size={24} color={colors.primary} />
          </Pressable>
        ),
        headerTitle: () => (
          <View style={styles.headerTitleWrap}>
            <Image source={require('../../assets/icon.png')} style={styles.headerIcon} />
            <View>
              <Text style={[styles.headerTitleText, { color: colors.text }]}>AgriMinds AI-DREWS</Text>
              <Text style={[styles.headerSubText, { color: colors.primary }]}>
                MoA Ethiopia · Choke Basin
              </Text>
            </View>
          </View>
        ),
        headerRight: () => (
          <Pressable
            onPress={toggleSidebar}
            style={[
              styles.headerRolePill,
              {
                backgroundColor:
                  role === 'minister'
                    ? dark
                      ? '#2a1a10'
                      : '#fff4ec'
                    : dark
                      ? '#13281b'
                      : '#e6f7ec',
                borderColor: role === 'minister' ? '#e06d10' : colors.primary,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Switch operating mode"
          >
            <Ionicons
              name={role === 'minister' ? 'briefcase' : role === 'da' ? 'clipboard' : 'leaf'}
              size={13}
              color={role === 'minister' ? '#e06d10' : colors.primary}
            />
            <Text
              style={[
                styles.headerRoleText,
                { color: role === 'minister' ? '#e06d10' : colors.primary },
              ]}
              numberOfLines={1}
            >
              {t(`roles.${role}`)}
            </Text>
          </Pressable>
        ),
        headerBackground: () => (
          <View style={{ flex: 1, backgroundColor: colors.surface }}>
            <View style={{ flexDirection: 'row', height: 3.5, width: '100%' }}>
              <View style={{ flex: 1, backgroundColor: '#078930' }} />
              <View style={{ flex: 1, backgroundColor: '#FCDD09' }} />
              <View style={{ flex: 1, backgroundColor: '#DA121A' }} />
            </View>
          </View>
        ),
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        headerStyle: { backgroundColor: colors.surface },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: role === 'minister' ? t('ministry.eyebrow') : t('farmer.eyebrow'),
          tabBarIcon: tabIcon(role === 'minister' ? 'stats-chart-outline' : 'leaf-outline'),
        }}
      />
      <Tabs.Screen name="grid" options={{ title: t('tabs.grid'), tabBarIcon: tabIcon('grid-outline') }} />
      <Tabs.Screen name="enso" options={{ title: t('tabs.enso'), tabBarIcon: tabIcon('thermometer-outline') }} />
      <Tabs.Screen name="settings" options={{ title: t('tabs.settings'), tabBarIcon: tabIcon('settings-outline') }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  headerMenuBtn: {
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
  },
  headerTitleText: {
    fontSize: 13,
    fontWeight: '800',
  },
  headerSubText: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerRolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 14,
    maxWidth: 120,
  },
  headerRoleText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
