import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, R, SP, withAlpha } from '../../../theme';
import { useMyMembership } from '../api/selfServiceQueries';

interface Props {
  /** Open the plan browser. */
  onPress: () => void;
  /** Open My membership (a checkout waiting for payment). */
  onOpenMyMembership?: () => void;
}

/**
 * Home card for members with no live membership (e.g. just self-registered): "Choose your
 * membership", or "Finish joining" while a checkout waits for payment. Renders nothing otherwise.
 */
export default function ChooseMembershipCard({ onPress, onOpenMyMembership }: Props) {
  const { data } = useMyMembership();
  if (!data) return null;
  const status = data.current?.status.toLowerCase();
  const pending = status === 'pending';
  if (data.current && !pending) return null;
  if (!pending && !data.rules.allowOnlineJoin) return null;

  const title = pending ? 'Finish joining' : 'Choose your membership';
  const sub = pending
    ? `${data.current!.planName} starts once it's paid${data.onlinePayments ? '' : ' at the front desk'}.`
    : 'Compare plans and join in a couple of minutes. No surprise fees.';
  const go = pending && onOpenMyMembership ? onOpenMyMembership : onPress;

  return (
    <Pressable
      onPress={go}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${sub}`}
      style={({ pressed }) => ({
        marginTop: SP.lg, padding: SP.lg, borderRadius: R.xl, borderWidth: 1, borderColor: withAlpha(T.brand, 0.35),
        backgroundColor: pressed ? T.bgInputActive : withAlpha(T.brand, 0.08), flexDirection: 'row', alignItems: 'center', gap: SP.md,
      })}
    >
      <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: T.brand, alignItems: 'center', justifyContent: 'center' }}>
        <Feather name={pending ? 'credit-card' : 'star'} size={22} color={T.onBrand} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: T.text, fontSize: 17, fontWeight: '800' }}>{title}</Text>
        <Text style={{ color: T.textSub, fontSize: 13, marginTop: 2, lineHeight: 18 }}>{sub}</Text>
      </View>
      <Feather name="chevron-right" size={22} color={T.brand} />
    </Pressable>
  );
}
