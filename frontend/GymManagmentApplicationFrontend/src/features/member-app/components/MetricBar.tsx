import React from 'react';
import { View, Text } from 'react-native';
import { T } from '../../../theme';

interface MetricBarProps {
  label: string;
  /** Null when there's no data — shown as "—". */
  current: number | null;
  /** Null when there's no real goal — only the value is shown, without a progress bar. */
  goal: number | null;
  unit?: string;
  color: string;
}

export default function MetricBar({ label, current, goal, unit, color }: MetricBarProps) {
  const hasGoal = current != null && goal != null && goal > 0;
  const pct = hasGoal ? Math.max(0, Math.min(100, (current / goal) * 100)) : 0;
  const u = unit ? ` ${unit}` : '';
  const valueText = current == null ? '—' : hasGoal ? `${current} / ${goal}${u}` : `${current}${u}`;

  return (
    <View
      style={{ marginBottom: 12 }}
      accessible
      accessibilityLabel={`${label}: ${current == null ? 'no data' : hasGoal ? `${current} of ${goal}${u}` : `${current}${u}`}`}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={{ color: T.textSub, fontSize: 13, fontWeight: '600' }}>{label}</Text>
        <Text style={{ color: T.text, fontSize: 12, fontWeight: '700' }}>{valueText}</Text>
      </View>
      {hasGoal && (
        <View style={{ height: 6, borderRadius: 3, backgroundColor: T.line, overflow: 'hidden' }}>
          <View style={{ width: `${pct}%`, height: '100%', borderRadius: 3, backgroundColor: color }} />
        </View>
      )}
    </View>
  );
}
