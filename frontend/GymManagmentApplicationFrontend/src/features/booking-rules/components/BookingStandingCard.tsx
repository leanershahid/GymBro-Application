import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, R, SP, withAlpha } from '../../../theme';
import { useMyStanding } from '../api/bookingRulesQueries';
import { longDay, penaltyTitle, shortWhen, strikesText, utc } from '../utils/bookingRulesFormat';

/**
 * My bookings: the blocked banner ("Booking paused until Tue 12 Nov" + Contact the gym) and the
 * strike counter ("1 of 3 no-shows in the last 30 days"). Renders nothing while all is clear.
 */
export default function BookingStandingCard({ userId, onContactGym }: { userId: number; onContactGym?: () => void }) {
  const { data } = useMyStanding(userId);
  if (!data) return null;
  const block = data.activeBlock;
  const until = utc(block?.until);
  const last = data.penalties.find(p => !p.waived);

  if (block && until) {
    return (
      <View
        accessibilityRole="alert"
        style={{
          marginBottom: SP.lg, padding: SP.lg, borderRadius: R.xl, borderWidth: 1,
          borderColor: withAlpha(T.err, 0.3), backgroundColor: withAlpha(T.err, 0.08),
        }}
      >
        <View style={{ flexDirection: 'row', gap: SP.md, alignItems: 'flex-start' }}>
          <Feather name="slash" size={20} color={T.err} style={{ marginTop: 1 }} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: T.text, fontSize: 15, fontWeight: '800' }}>Booking paused until {longDay(until)}</Text>
            <Text style={{ color: T.textSub, fontSize: 13, marginTop: 4, lineHeight: 19 }}>
              {block.reason ? `${block.reason}. ` : ''}You can't book classes or personal training yourself until {shortWhen(until)}. The front desk can still book you in.
            </Text>
            {onContactGym && (
              <Pressable onPress={onContactGym} accessibilityRole="link" hitSlop={8} style={{ marginTop: SP.md, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ color: T.brand, fontSize: 14, fontWeight: '700' }}>Contact the gym</Text>
                <Feather name="arrow-right" size={14} color={T.brand} />
              </Pressable>
            )}
          </View>
        </View>
      </View>
    );
  }

  if (!data.strikesEnabled || data.strikes <= 0) return null;
  const close = data.strikes >= data.strikesBeforeBlock - 1;
  const tone = close ? T.brandGold : T.textSub;
  return (
    <View style={{
      marginBottom: SP.lg, padding: SP.md, paddingHorizontal: SP.lg, borderRadius: R.lg, borderWidth: 1,
      borderColor: withAlpha(tone, 0.28), backgroundColor: withAlpha(tone, 0.08), flexDirection: 'row', gap: SP.md, alignItems: 'center',
    }}>
      <Feather name="alert-circle" size={18} color={tone} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: T.text, fontSize: 14, fontWeight: '700' }}>
          {strikesText(data.strikes, data.strikesBeforeBlock, data.strikeWindowDays)}
        </Text>
        <Text style={{ color: T.textFaint, fontSize: 12, marginTop: 2 }}>
          {close ? 'One more and booking pauses for a while. ' : ''}
          {last ? `Last: ${penaltyTitle(last.type).toLowerCase()}${last.label ? ` · ${last.label}` : ''}` : ''}
        </Text>
      </View>
    </View>
  );
}
