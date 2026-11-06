import React from 'react';
import { Pressable, StyleProp, Text, View, ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, SP, R, withAlpha } from '../../../theme';
import { useSupportCount } from '../api/supportQueries';

/** Trainer Home: "N help requests assigned to you" (hidden when none). */
export default function AssignedSupportCard({ onPress, style }: { onPress: () => void; style?: StyleProp<ViewStyle> }) {
  const c = useSupportCount('trainer').data;
  if (!c || c.badge === 0) return null;
  const overdue = c.overdue > 0;
  return (
    <Pressable onPress={onPress} accessibilityRole="button"
      accessibilityLabel={`${c.badge} help request${c.badge > 1 ? 's' : ''} assigned to you${overdue ? `, ${c.overdue} overdue` : ''}`}
      style={({ pressed }) => [style, {
        flexDirection: 'row', alignItems: 'center', gap: SP.md, padding: SP.lg, borderRadius: R.xl, borderWidth: 1, minHeight: 64,
        borderColor: withAlpha(overdue ? T.err : T.brandGold, 0.35), backgroundColor: pressed ? T.bgInputActive : T.bgInput,
      }]}>
      <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: withAlpha(overdue ? T.err : T.brandGold, 0.14) }}>
        <Feather name="life-buoy" size={18} color={overdue ? T.err : T.brandGold} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: T.text, fontSize: 15, fontWeight: '700' }}>{c.badge} help request{c.badge > 1 ? 's' : ''} for you</Text>
        <Text style={{ color: overdue ? T.err : T.textSub, fontSize: 13 }}>{overdue ? `${c.overdue} overdue — reply when you can` : 'Members are waiting on a reply'}</Text>
      </View>
      <Feather name="chevron-right" size={18} color={T.textFaint} />
    </Pressable>
  );
}
