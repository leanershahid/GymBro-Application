import React from 'react';
import { View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { T } from '../../trainers/components/theme';

interface StreakCardProps {
  days: number;
  growthPct?: number;
}

export default function StreakCard({ days, growthPct }: StreakCardProps) {
  return (
    <View
      style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: T.bgInput, borderRadius: 18, padding: 14,
        borderWidth: 1, borderColor: T.line,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <LinearGradient
          colors={T.brandGradient}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}
        >
          <Feather name="zap" size={20} color={T.onBrand} />
        </LinearGradient>
        <View>
          <Text style={{ color: T.textSub, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>
            Streak
          </Text>
          <Text style={{ color: T.text, fontSize: 18, fontWeight: '800', marginTop: 2 }}>{days} days</Text>
        </View>
      </View>

      {growthPct !== undefined && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Feather name="trending-up" size={14} color={T.brand} />
          <Text style={{ color: T.brand, fontSize: 13, fontWeight: '700' }}>+{growthPct}%</Text>
        </View>
      )}
    </View>
  );
}
