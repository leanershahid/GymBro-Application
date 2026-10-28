import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { T, R } from '../../../theme';
import AreaChart from './AreaChart';
import { RevenueTrendPoint } from '../types/dashboard';
import { formatInrCompact, formatPct } from './formatInr';

/**
 * The detailed revenue series. The hero already shows this month's total, so this card
 * deliberately shows what the hero does not: the axis-labelled history, the monthly
 * average, the best month and the change across the whole window.
 */
export default function RevenueTrendCard({ trend }: { trend: RevenueTrendPoint[] }) {
  const [w, setW] = useState(0);
  if (trend.length < 2) return null;

  const values = trend.map(p => p.value);
  const max = Math.max(...values, 1);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const best = trend.reduce((a, b) => (b.value > a.value ? b : a));
  const first = trend[0];
  const change = first.value > 0 ? ((trend[trend.length - 1].value - first.value) / first.value) * 100 : 0;
  const yLabels = [1, 0.75, 0.5, 0.25, 0].map(f => formatInrCompact(max * f, { symbol: false, digits: 0 }));

  const facts = [
    { label: 'Avg / month', value: formatInrCompact(avg) },
    { label: 'Best month', value: best.label },
    { label: `Since ${first.label}`, value: formatPct(change), color: change >= 0 ? T.brand : T.err },
  ];

  return (
    <View style={{ borderRadius: R.lg, padding: 16, backgroundColor: T.bgInput, borderWidth: 1, borderColor: T.line }}>
      <View style={{ flexDirection: 'row', marginBottom: 16 }}>
        {facts.map((f, i) => (
          <View
            key={f.label}
            accessible
            accessibilityLabel={`${f.label}: ${f.value}`}
            style={{ flex: 1, paddingLeft: i === 0 ? 0 : 12, borderLeftWidth: i === 0 ? 0 : 1, borderLeftColor: T.line }}
          >
            <Text numberOfLines={1} style={{ color: T.textFaint, fontSize: 11, fontWeight: '600' }}>{f.label}</Text>
            <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: f.color ?? T.text, fontSize: 16, fontWeight: '800', marginTop: 2 }}>
              {f.value}
            </Text>
          </View>
        ))}
      </View>
      <View
        onLayout={e => setW(e.nativeEvent.layout.width)}
        accessible
        accessibilityLabel={`Revenue by month: ${trend.map(p => `${p.label} ${formatInrCompact(p.value)}`).join(', ')}`}
      >
        {w > 0 && <AreaChart data={trend} width={w} height={140} yLabels={yLabels} />}
      </View>
    </View>
  );
}
