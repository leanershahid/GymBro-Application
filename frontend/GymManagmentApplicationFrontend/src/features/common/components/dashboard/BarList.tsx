import React from 'react';
import { View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { T, R, withAlpha } from '../../../../theme';

export interface BarRow {
  key: string;
  label: string;
  value: number;
  /** Text on the right; defaults to the value. */
  display?: string;
  /** Small line under the label. */
  hint?: string;
}

/** Ranked horizontal bars — compares branches, clients, workouts at a glance. */
export default function BarList({ rows, max }: { rows: BarRow[]; max?: number }) {
  const top = max ?? Math.max(...rows.map(r => r.value), 1);
  return (
    <View style={{ gap: 14 }}>
      {rows.map(r => {
        const pct = Math.max(0.04, Math.min(1, r.value / top));
        return (
          <View key={r.key} accessible accessibilityLabel={`${r.label}: ${r.display ?? r.value}`}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6, gap: 8 }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ color: T.text, fontSize: 13, fontWeight: '700' }}>{r.label}</Text>
                {r.hint && <Text numberOfLines={1} style={{ color: T.textFaint, fontSize: 11 }}>{r.hint}</Text>}
              </View>
              <Text style={{ color: T.textSub, fontSize: 12, fontWeight: '700' }}>{r.display ?? r.value}</Text>
            </View>
            <View style={{ height: 8, borderRadius: R.pill, backgroundColor: withAlpha(T.text, 0.06), overflow: 'hidden' }}>
              <LinearGradient
                colors={[...T.brandGradient]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={{ width: `${pct * 100}%`, height: '100%', borderRadius: R.pill }}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}
