import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { radius, useTheme } from '@/theme';

interface Props {
  onMove: (dRow: number, dCol: number) => void;
  label: string;
}

const Arrow = ({ name, onPress, color, bg }: { name: keyof typeof Ionicons.glyphMap; onPress: () => void; color: string; bg: string }) => (
  <Pressable onPress={onPress} style={[styles.btn, { backgroundColor: bg }]} accessibilityRole="button" hitSlop={6}>
    <Ionicons name={name} size={20} color={color} />
  </Pressable>
);

export function ThumbPad({ onMove, label }: Props) {
  const { colors } = useTheme();
  const bg = colors.surfaceAlt;
  return (
    <View style={styles.pad} accessibilityLabel={label}>
      <View style={styles.rowCenter}>
        <Arrow name="chevron-up" onPress={() => onMove(-1, 0)} color={colors.text} bg={bg} />
      </View>
      <View style={styles.rowBetween}>
        <Arrow name="chevron-back" onPress={() => onMove(0, -1)} color={colors.text} bg={bg} />
        <View style={styles.spacer} />
        <Arrow name="chevron-forward" onPress={() => onMove(0, 1)} color={colors.text} bg={bg} />
      </View>
      <View style={styles.rowCenter}>
        <Arrow name="chevron-down" onPress={() => onMove(1, 0)} color={colors.text} bg={bg} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { alignSelf: 'center', gap: 4 },
  rowCenter: { flexDirection: 'row', justifyContent: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  spacer: { width: 44 },
  btn: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
