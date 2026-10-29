import React, { useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, R, SP, withAlpha } from '../../../theme';
import { useMyClasses, useMyPtSessions } from '../api/bookingQueries';
import { upcomingItems, dayLabel, formatTimeRange, classColor } from '../utils/bookingFormat';

interface Props {
  userId: number;
  onPress?: () => void;
}

/** Home card: the member's next class or PT session. Renders nothing when there isn't one. */
export default function NextBookingCard({ userId, onPress }: Props) {
  const classesQ = useMyClasses(userId);
  const ptQ = useMyPtSessions(userId);
  const next = useMemo(() => upcomingItems(classesQ.data ?? [], ptQ.data ?? [])[0], [classesQ.data, ptQ.data]);

  if (!next) return null;

  const isClass = next.kind === 'class';
  const accent = isClass ? classColor(next.cls) : T.violet;
  const title = isClass ? next.cls.title : next.session.sessionTypeName;
  const trainer = isClass ? next.cls.trainerName : next.session.trainerName;
  const waitlisted = isClass && next.cls.myBooking === 'Waitlisted';
  const when = `${dayLabel(next.startsAt)} · ${formatTimeRange(next.startsAt, next.endsAt)}`;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`Next ${isClass ? 'class' : 'session'}: ${title}, ${when}${trainer ? `, with ${trainer}` : ''}`}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: SP.md, padding: SP.lg, borderRadius: R.xl,
        backgroundColor: pressed ? T.bgInputActive : T.bgInput, borderWidth: 1, borderColor: withAlpha(accent, 0.28),
      })}
    >
      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: withAlpha(accent, 0.12), alignItems: 'center', justifyContent: 'center' }}>
        <Feather name={isClass ? 'calendar' : 'user-check'} size={20} color={accent} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: T.textSub, fontSize: 11, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' }}>
          {isClass ? (waitlisted ? 'Next class · waitlisted' : 'Next class') : 'Next PT session'}
        </Text>
        <Text numberOfLines={1} style={{ color: T.text, fontSize: 16, fontWeight: '800', marginTop: 2 }}>{title}</Text>
        <Text numberOfLines={1} style={{ color: T.textSub, fontSize: 13, marginTop: 2 }}>
          {when}{trainer ? ` · ${trainer}` : ''}
        </Text>
      </View>
      {onPress && <Feather name="chevron-right" size={18} color={T.textFaint} />}
    </Pressable>
  );
}
