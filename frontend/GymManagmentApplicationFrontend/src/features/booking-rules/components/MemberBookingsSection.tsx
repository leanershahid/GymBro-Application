import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { T, R, SP, withAlpha } from '../../../theme';
import SmallButton from '../../common/components/SmallButton';
import { useToast } from '../../common/components/Toast';
import { showAlert } from '../../common/components/dialogs';
import { apiErrorText } from '../../../api/apiError';
import { useLiftBlock, useMemberStanding } from '../api/bookingRulesQueries';
import { BookingPenalty } from '../types/bookingRules.types';
import { longDay, strikesText, utc } from '../utils/bookingRulesFormat';
import { PenaltyRow, WaiveSheet } from './PenaltyList';

/**
 * Member detail → "Bookings": strikes in the window, the active block with "Lift block", and the
 * recent penalties with "Waive". Hidden when the caller can't read them (no classes module).
 */
export default function MemberBookingsSection({ memberId }: { memberId: number }) {
  const toast = useToast();
  const { data, isError } = useMemberStanding(memberId);
  const lift = useLiftBlock();
  const [waiving, setWaiving] = useState<BookingPenalty | null>(null);
  if (isError || !data) return null;
  const block = data.activeBlock;
  const until = utc(block?.until);
  if (!block && data.strikes === 0 && data.penalties.length === 0) return null;

  const liftNow = () => {
    if (!block) return;
    showAlert('Lift booking block?', 'The member can book classes and PT themselves again straight away.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Lift block', style: 'destructive',
        onPress: () => lift.mutate({ id: block.id }, {
          onSuccess: () => toast.show({ type: 'success', message: 'Booking block lifted.' }),
          onError: e => showAlert('Couldn’t lift', apiErrorText(e)),
        }),
      },
    ]);
  };

  return (
    <View style={{ marginTop: SP.xl }}>
      <Text accessibilityRole="header" style={{ color: T.text, fontSize: 18, fontWeight: '700', marginBottom: SP.md }}>Bookings</Text>
      {data.strikesEnabled && (
        <Text style={{ color: T.textSub, fontSize: 14, marginBottom: SP.md }}>
          {strikesText(data.strikes, data.strikesBeforeBlock, data.strikeWindowDays)}
        </Text>
      )}
      {block && until && (
        <View style={{
          padding: SP.md, marginBottom: SP.md, borderRadius: R.md, borderWidth: 1,
          borderColor: withAlpha(T.err, 0.3), backgroundColor: withAlpha(T.err, 0.08),
        }}>
          <Text style={{ color: T.text, fontSize: 14, fontWeight: '700' }}>Self-booking blocked until {longDay(until)}</Text>
          <Text style={{ color: T.textSub, fontSize: 12, marginTop: 2 }}>{block.reason}. Staff can still book on their behalf.</Text>
          {data.canWaive && (
            <View style={{ flexDirection: 'row', marginTop: SP.sm }}>
              <SmallButton icon="unlock" label="Lift block" size="sm" busy={lift.isPending} onPress={liftNow} />
            </View>
          )}
        </View>
      )}
      {data.penalties.map(p => (
        <PenaltyRow key={p.id} p={p} showLabel onWaive={data.canWaive ? setWaiving : undefined} />
      ))}
      <WaiveSheet penalty={waiving} onClose={() => setWaiving(null)} />
    </View>
  );
}
