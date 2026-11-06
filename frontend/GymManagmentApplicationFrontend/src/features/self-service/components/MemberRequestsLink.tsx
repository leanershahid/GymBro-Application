import React from 'react';
import { Text, Pressable, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, R, SP, withAlpha } from '../../../theme';
import { useRequestQueue } from '../api/selfServiceQueries';

/** Member detail: "Membership requests (n pending)" link into the staff queue filtered to this member. */
export default function MemberRequestsLink({ memberId, onPress }: { memberId: number; onPress: () => void }) {
  const q = useRequestQueue({ status: 'all', memberId });
  const items = q.data?.items ?? [];
  if (q.isLoading || items.length === 0) return null;
  const pending = items.filter(i => i.status === 'pending').length;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Membership requests, ${pending} pending`}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: SP.md, minHeight: 52, padding: SP.md, borderRadius: R.lg, borderWidth: 1,
        borderColor: pending ? withAlpha(T.brandGold, 0.35) : T.line, backgroundColor: pressed ? T.bgInputActive : T.bgInput,
      })}
    >
      <Feather name="inbox" size={18} color={pending ? T.brandGold : T.textSub} />
      <Text style={{ flex: 1, color: T.text, fontSize: 15, fontWeight: '700' }}>Membership requests</Text>
      {pending > 0 && (
        <View style={{ minWidth: 24, paddingHorizontal: 8, height: 24, borderRadius: 12, backgroundColor: T.brandGold, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: T.onBrand, fontSize: 12, fontWeight: '800' }}>{pending}</Text>
        </View>
      )}
      <Feather name="chevron-right" size={18} color={T.textFaint} />
    </Pressable>
  );
}
