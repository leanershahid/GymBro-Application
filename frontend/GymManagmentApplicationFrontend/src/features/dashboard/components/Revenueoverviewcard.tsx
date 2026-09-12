import React, { useState } from 'react';
import { View, Text, Pressable, LayoutChangeEvent } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, Shadow } from '../../trainers/components/theme';
import AreaChart from './AreaChart';
import { RevenueTrendPoint } from '../types/dashboard';

interface RevenueOverviewCardProps {
  totalRevenue: number;
  growthPct: number;
  trend: RevenueTrendPoint[];
}

function formatCurrency(value: number): string {
  return `₹${value.toLocaleString('en-IN')}`;
}

// Shared glass card style — brand-tinted since this is the hero metric card
const glass = {
  backgroundColor: T.bgInput,
  borderWidth: 1,
  borderColor: T.brandBorder,
  ...Shadow.neon,
};

const PERIODS = ['This month', 'Last month', 'This year'] as const;
type Period = typeof PERIODS[number];

export default function RevenueOverviewCard({
  totalRevenue,
  growthPct,
  trend,
}: RevenueOverviewCardProps) {
  const [period, setPeriod] = useState<Period>('This month');
  const [chartWidth, setChartWidth] = useState(0);
  const isPositive = growthPct >= 0;

  const onChartLayout = (e: LayoutChangeEvent) => setChartWidth(e.nativeEvent.layout.width);

  const maxValue = Math.max(...trend.map((p) => p.value), 1);
  const yLabels = [maxValue, maxValue * 0.75, maxValue * 0.5, maxValue * 0.25, 0].map(
    (v) => (v >= 1000 ? `${Math.round(v / 1000)}K` : `${Math.round(v)}`)
  );

  return (
    <View style={[glass, { borderRadius: 24, padding: 20 }]}>
      {/* Top row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={{ color: T.textSub, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 }}>
          Total Revenue
        </Text>

        {/* Period tabs — note: only "This month" is backed by real distinct data today;
            switching tabs re-labels the same trend series until per-period data exists. */}
        <View style={{ flexDirection: 'row', backgroundColor: T.bg, borderRadius: 999, padding: 3, borderWidth: 1, borderColor: T.line }}>
          {PERIODS.map((p) => {
            const active = p === period;
            return (
              <Pressable
                key={p}
                onPress={() => setPeriod(p)}
                accessibilityRole="button"
                accessibilityLabel={p}
                style={{
                  paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
                  backgroundColor: active ? T.brand : 'transparent',
                }}
              >
                <Text style={{ color: active ? T.onBrand : T.textSub, fontSize: 10.5, fontWeight: '700' }}>{p}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Amount */}
      <Text
        style={{ color: T.text, fontWeight: '800', fontSize: 34, letterSpacing: -1, marginTop: 4 }}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {formatCurrency(totalRevenue)}
      </Text>

      {/* Badge */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 18 }}>
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginRight: 10,
          backgroundColor: isPositive ? 'rgba(126,211,33,0.12)' : 'rgba(255,77,77,0.12)',
          borderWidth: 1,
          borderColor: isPositive ? 'rgba(126,211,33,0.25)' : 'rgba(255,77,77,0.25)',
        }}>
          <Feather
            name={isPositive ? 'trending-up' : 'trending-down'}
            size={13}
            color={isPositive ? T.brand : T.err}
          />
          <Text style={{ fontSize: 12, fontWeight: '700', marginLeft: 5, color: isPositive ? T.brand : T.err }}>
            {isPositive ? '+' : ''}{growthPct}%
          </Text>
        </View>
        <Text style={{ color: T.textSub, fontSize: 12 }}>vs last month</Text>
      </View>

      {/* Full chart with axes */}
      <View onLayout={onChartLayout}>
        {chartWidth > 0 && (
          <AreaChart data={trend} width={chartWidth} height={140} yLabels={yLabels} />
        )}
      </View>
    </View>
  );
}
