import type { DroughtMapResponse, GridCellRisk } from '@agriminds/api-types';
import { riskLevelFor } from '@agriminds/api-types';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { riskColors, useTheme } from '@/theme';

interface Props {
  map: DroughtMapResponse;
  selected: { row: number; col: number } | null;
  onSelect: (row: number, col: number) => void;
  insideMask?: boolean[][];
}

export function GridMap({ map, selected, onSelect, insideMask }: Props) {
  const { colors, dark } = useTheme();

  // Quick lookup for cell metadata
  const cellMetaMap = useMemo(() => {
    const lookup = new Map<string, GridCellRisk>();
    if (map.cells) {
      for (const cell of map.cells) {
        lookup.set(`${cell.row}:${cell.col}`, cell);
      }
    }
    return lookup;
  }, [map.cells]);

  return (
    <View style={[styles.grid, { borderColor: colors.border, backgroundColor: dark ? '#0f1713' : '#f8fafc' }]}>
      {map.probabilities.map((row, r) => (
        <View key={r} style={styles.row}>
          {row.map((p, c) => {
            const level = riskLevelFor(p);
            const active = selected?.row === r && selected?.col === c;
            const meta = cellMetaMap.get(`${r}:${c}`);
            const isInside = insideMask?.[r]?.[c] ?? meta?.in_watershed ?? true;

            return (
              <Pressable
                key={c}
                onPress={() => onSelect(r, c)}
                accessibilityRole="button"
                accessibilityLabel={`Row ${r} column ${c}, ${Math.round(p * 100)} percent risk, ${level}, ${isInside ? 'inside watershed' : 'buffer cell'}`}
                accessibilityState={{ selected: active }}
                style={[
                  styles.cell,
                  { backgroundColor: riskColors[level].bg },
                  !isInside && styles.outsideCell,
                  active && [styles.active, { borderColor: colors.accent }],
                ]}
              >
                <Text style={[styles.cellText, { color: riskColors[level].fg }]}>{Math.round(p * 100)}%</Text>
                {!isInside && <View style={[styles.outsideDot, { backgroundColor: colors.textMuted }]} />}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { borderWidth: 1, borderRadius: 10, overflow: 'hidden', gap: 3, padding: 4 },
  row: { flexDirection: 'row', gap: 3 },
  cell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 5,
    position: 'relative',
  },
  outsideCell: {
    opacity: 0.72,
    borderWidth: 1,
    borderColor: 'rgba(150, 150, 150, 0.35)',
    borderStyle: 'dashed',
  },
  outsideDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 3.5,
    height: 3.5,
    borderRadius: 2,
  },
  active: { borderWidth: 3 },
  cellText: { fontSize: 10, fontWeight: '800' },
});
