import { Ionicons } from '@expo/vector-icons';
import type { ColorValue } from 'react-native';
import { Image, View } from 'react-native';
import { Tabs } from 'expo-router';
import React from 'react';

import { useI18n } from '@/i18n';
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
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerTitle: () => (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Image source={require('../../assets/icon.png')} style={{ width: 28, height: 28, borderRadius: 6 }} />
          </View>
        ),
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tabs.advisory'), tabBarIcon: tabIcon('leaf-outline') }} />
      <Tabs.Screen name="grid" options={{ title: t('tabs.grid'), tabBarIcon: tabIcon('grid-outline') }} />
      <Tabs.Screen name="enso" options={{ title: t('tabs.enso'), tabBarIcon: tabIcon('thermometer-outline') }} />
      <Tabs.Screen name="settings" options={{ title: t('tabs.settings'), tabBarIcon: tabIcon('settings-outline') }} />
    </Tabs>
  );
}
