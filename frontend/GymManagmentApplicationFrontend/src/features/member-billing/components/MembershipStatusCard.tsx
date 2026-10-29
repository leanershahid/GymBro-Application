import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, R, SP, withAlpha } from '../../../theme';
import StatusPill from '../../common/components/StatusPill';
import { useMyMemberships, useMyInvoices } from '../api/memberBillingQueries';
import { membershipTone } from './billingTones';
import { splitMemberships, daysLeftLabel, daysUntil, totalDue, isFrozen } from '../utils/billingFormat';

interface Props {
  userId: number;
  onPress?: () => void;
}

/** Compact Home card: current plan, days left and anything owed. Renders nothing without memberships. */
export default function MembershipStatusCard({ userId, onPress }: Props) {
  const { data: memberships } = useMyMemberships(userId);
  const { data: invoices = [] } = useMyInvoices(userId);

  if (!memberships?.length) return null;
  const { current } = splitMemberships(memberships);
  if (!current) return null;

  const frozen = isFrozen(current);
  const left = daysLeftLabel(current);
  const n = daysUntil(current.endDate);
  const ending = n !== null && n >= 0 && n <= 7 && current.status.toLowerCase() === 'active';
  const due = totalDue(invoices);
  const accent = due ? T.brandGold : T.brand;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`Membership ${current.planName}, ${current.status}${left ? `, ${left}` : ''}${due ? `, ${due} due` : ''}`}
      style={({ pressed }) => ({
        backgroundColor: pressed ? T.bgInputActive : T.bgInput,
        borderRadius: R.xl, borderWidth: 1, borderColor: withAlpha(accent, 0.28),
        padding: SP.lg, flexDirection: 'row', alignItems: 'center', gap: SP.md,
      })}
    >
      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: withAlpha(accent, 0.12), alignItems: 'center', justifyContent: 'center' }}>
        <Feather name={frozen ? 'pause-circle' : 'credit-card'} size={20} color={accent} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text numberOfLines={1} style={{ color: T.text, fontSize: 15, fontWeight: '700', flexShrink: 1 }}>{current.planName}</Text>
          <StatusPill label={frozen ? 'Frozen' : current.status} tone={membershipTone(frozen ? 'frozen' : current.status)} />
        </View>
        {!!left && (
          <Text style={{ color: ending ? T.brandGold : T.textSub, fontSize: 12, marginTop: 3 }}>{left}</Text>
        )}
        {!!due && (
          <Text style={{ color: T.brandGold, fontSize: 12, fontWeight: '700', marginTop: 3 }}>{due} due</Text>
        )}
      </View>
      {onPress && <Feather name="chevron-right" size={20} color={T.textFaint} />}
    </Pressable>
  );
}
