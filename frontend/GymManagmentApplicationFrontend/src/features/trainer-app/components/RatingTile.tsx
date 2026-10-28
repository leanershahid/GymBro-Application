import React from 'react';
import { View, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, R } from '../../../theme';
import ProgressRing from '../../common/components/dashboard/ProgressRing';

interface Props {
  /** 0–5, or null when the trainer has no ratings yet. */
  rating: number | null;
  width: number;
  /** Match the height of neighbouring KPI tiles. */
  minHeight?: number;
}

/** KPI tile for the coach rating — same shell as KpiTile, with a ring showing rating / 5. */
export default function RatingTile({ rating, width, minHeight }: Props) {
  const has = rating != null && rating > 0;
  const value = has ? rating!.toFixed(1) : '—';
  return (
    <View
      accessible
      accessibilityLabel={has ? `Rating: ${value} out of 5` : 'Rating: no ratings yet'}
      style={{
        width, minHeight, padding: 14, borderRadius: R.lg,
        backgroundColor: T.bgInput, borderWidth: 1, borderColor: T.line,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
      }}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: T.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 }}>{value}</Text>
        <Text numberOfLines={1} style={{ color: T.textSub, fontSize: 12, marginTop: 2 }}>Rating</Text>
        <Text numberOfLines={1} style={{ color: T.textFaint, fontSize: 11, marginTop: 2 }}>{has ? 'out of 5' : 'No ratings yet'}</Text>
      </View>
      <View style={{ width: 56, height: 56, alignItems: 'center', justifyContent: 'center' }}>
        <ProgressRing
          progress={has ? rating! / 5 : 0}
          size={56}
          stroke={6}
          accessibilityLabel={has ? `${value} of 5 stars` : 'No rating'}
        />
        <View pointerEvents="none" style={{ position: 'absolute' }}>
          <Feather name="star" size={18} color={has ? T.brandGold : T.textFaint} />
        </View>
      </View>
    </View>
  );
}
