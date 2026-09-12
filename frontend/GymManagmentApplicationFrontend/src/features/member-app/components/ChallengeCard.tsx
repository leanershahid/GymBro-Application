import React from 'react';
import { View, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T } from '../../trainers/components/theme';

interface ChallengeCardProps {
  title: string;
  participantCount: number;
  prizeLabel: string | null;
  progressPct: number;
}

export default function ChallengeCard({ title, participantCount, prizeLabel, progressPct }: ChallengeCardProps) {
  const pct = Math.max(0, Math.min(100, progressPct));

  return (
    <View style={{ backgroundColor: T.bgInput, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: T.line }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={{ color: T.text, fontSize: 15, fontWeight: '700' }}>{title}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Feather name="users" size={11} color={T.textFaint} />
              <Text style={{ color: T.textSub, fontSize: 11 }}>{participantCount.toLocaleString()} joined</Text>
            </View>
            {prizeLabel && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Feather name="award" size={11} color={T.textFaint} />
                <Text style={{ color: T.textSub, fontSize: 11 }}>{prizeLabel}</Text>
              </View>
            )}
          </View>
        </View>
        <Text style={{ color: T.brand, fontSize: 16, fontWeight: '800' }}>{Math.round(pct)}%</Text>
      </View>

      <View style={{ height: 6, borderRadius: 3, backgroundColor: T.line, overflow: 'hidden' }}>
        <View style={{ width: `${pct}%`, height: '100%', borderRadius: 3, backgroundColor: T.brand }} />
      </View>
    </View>
  );
}
