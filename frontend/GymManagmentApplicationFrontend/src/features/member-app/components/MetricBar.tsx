import React from 'react';
import { View, Text } from 'react-native';
import { T } from '../../trainers/components/theme';

interface MetricBarProps {
  label: string;
  current: number;
  goal: number;
  unit?: string;
  color: string;
}

export default function MetricBar({ label, current, goal, unit, color }: MetricBarProps) {
  const pct = goal > 0 ? Math.min(100, (current / goal) * 100) : 0;

  return (
    <View style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={{ color: T.textSub, fontSize: 13, fontWeight: '600' }}>{label}</Text>
        <Text style={{ color: T.text, fontSize: 12, fontWeight: '700' }}>
          {current} / {goal}{unit ? ` ${unit}` : ''}
        </Text>
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: T.line, overflow: 'hidden' }}>
        <View style={{ width: `${pct}%`, height: '100%', borderRadius: 3, backgroundColor: color }} />
      </View>
    </View>
  );
}
