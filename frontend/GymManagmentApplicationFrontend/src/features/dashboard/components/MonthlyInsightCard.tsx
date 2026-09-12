import React from 'react';
import { View, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, Shadow } from '../../trainers/components/theme';
import RevenueSparkline from './Revenuesparkline';
import { RevenueTrendPoint } from '../types/dashboard';

interface MonthlyInsightCardProps {
  growthPct: number;
  activeBranches: number;
  trend: RevenueTrendPoint[];
}

/**
 * The headline "this month is off to a strong start" insight — a compact
 * summary card that replaces the old plain text row, pairing the message
 * with a mini trend chart so the takeaway reads at a glance.
 */
export default function MonthlyInsightCard({ growthPct, activeBranches, trend }: MonthlyInsightCardProps) {
  return (
    <View
      style={[
        {
          flexDirection: 'row', alignItems: 'center',
          backgroundColor: T.bgInput, borderRadius: 22, padding: 16,
          borderWidth: 1, borderColor: T.line,
        },
        Shadow.sm,
      ]}
    >
      <View style={{
        width: 52, height: 52, borderRadius: 26,
        backgroundColor: T.brandDim, borderWidth: 1, borderColor: T.brandBorder,
        alignItems: 'center', justifyContent: 'center', marginRight: 14,
      }}>
        <Feather name="arrow-up-right" size={22} color={T.brand} />
      </View>

      <View style={{ flex: 1, paddingRight: 10 }}>
        <Text style={{ color: T.text, fontSize: 15, fontWeight: '800', marginBottom: 3 }}>
          {growthPct >= 0 ? 'This month is off to a strong start!' : 'Revenue dipped this month'}
        </Text>
        <Text style={{ color: T.textSub, fontSize: 12.5, lineHeight: 18 }}>
          Revenue is up <Text style={{ color: T.brand, fontWeight: '700' }}>{growthPct}%</Text> this month, with {activeBranches} branch{activeBranches === 1 ? '' : 'es'} running at full strength.
        </Text>
      </View>

      <RevenueSparkline data={trend} height={44} />
    </View>
  );
}
