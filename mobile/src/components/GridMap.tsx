import type { DroughtMapResponse } from '@agriminds/api-types';
import { riskLevelFor } from '@agriminds/api-types';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { riskColors, useTheme } from '@/theme';

interface Props {
  map: DroughtMapResponse;
  selected: { row: number; col: number } | null;
  onSelect: (row: number, col: number) => void;
}

export function GridMap({ map, selected, onSelect }: Props) {
  const { colors } = useTheme();
  return (
    <View style={[styles.grid, { borderColor: colors.border }]}>
      {map.probabilities.map((row, r) => (
        <View key={r} style={styles.row}>
          {row.map((p, c) => {
            const level = riskLevelFor(p);
            const active = selected?.row === r && selected?.col === c;
            return (
              <Pressable
                key={c}
                onPress={() => onSelect(r, c)}
                accessibilityRole="button"
                accessibilityLabel={`Row ${r} column ${c}, ${Math.round(p * 100)} percent, ${level}`}
                accessibilityState={{ selected: active }}
                style={[styles.cell, { backgroundColor: riskColors[level].bg }, active && [styles.active, { borderColor: colors.accent }]]}
              >
                <Text style={[styles.cellText, { color: riskColors[level].fg }]}>{Math.round(p * 100)}</Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { borderWidth: 1, borderRadius: 10, overflow: 'hidden', gap: 2, padding: 2 },
  row: { flexDirection: 'row', gap: 2 },
  cell: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 4 },
  active: { borderWidth: 3 },
  cellText: { fontSize: 11, fontWeight: '800' },
});
