import React, { useMemo, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, R, SP, withAlpha } from '../../../theme';
import { apiErrorText } from '../../../api/apiError';
import StatusPill, { PillTone } from '../../common/components/StatusPill';
import Skeleton from '../../common/components/Skeleton';
import EmptyState from '../../dashboard/components/EmptyState';
import { useToast } from '../../common/components/Toast';
import { useClassSchedule, useBookClass, useCancelClassBooking } from '../api/bookingQueries';
import { GymClass } from '../types/booking.types';
import {
  parseUtc, formatTimeRange, startOfLocalDay, addDays, sameLocalDay, dayLabel,
  classColor, isClassCancelled, spotsLeft,
} from '../utils/bookingFormat';
import { Card, InlineError, ActionButton, DayStrip } from './BookingUi';

const DAYS = 14;

function fullDayLabel(d: Date): string {
  const long = d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  const rel = dayLabel(d);
  return rel === 'Today' || rel === 'Tomorrow' ? `${rel} · ${long}` : long;
}

const BOOKING_PILL: Record<string, { label: string; tone: PillTone }> = {
  Booked: { label: 'Booked', tone: 'ok' },
  Waitlisted: { label: 'Waitlisted', tone: 'warn' },
  Attended: { label: 'Attended', tone: 'brand' },
  NoShow: { label: 'Missed', tone: 'err' },
};

function ClassCard({ cls, pending, busy, onBook, onCancel }: {
  cls: GymClass; pending: boolean; busy: boolean;
  onBook: (c: GymClass) => void; onCancel: (c: GymClass) => void;
}) {
  const start = parseUtc(cls.startsAt);
  const end = parseUtc(cls.endsAt) ?? start;
  const color = classColor(cls);
  const cancelled = isClassCancelled(cls);
  const started = !!start && start.getTime() <= Date.now();
  const left = spotsLeft(cls);
  const full = left === 0;
  const pill = cancelled ? { label: 'Cancelled', tone: 'err' as PillTone } : cls.myBooking ? BOOKING_PILL[cls.myBooking] : undefined;

  let spotsText: string;
  if (left == null) spotsText = `${cls.booked} booked`;
  else if (full) spotsText = cls.waitlisted ? `Full · ${cls.waitlisted} on waitlist` : 'Full';
  else spotsText = `${left} spot${left === 1 ? '' : 's'} left`;

  let action: React.ReactNode = null;
  if (!cancelled && !started) {
    if (cls.myBooking === 'Booked') {
      action = <ActionButton label="Cancel booking" icon="x" variant="danger" busy={pending} disabled={busy} onPress={() => onCancel(cls)} accessibilityLabel={`Cancel booking for ${cls.title}`} />;
    } else if (cls.myBooking === 'Waitlisted') {
      action = <ActionButton label="Leave waitlist" icon="x" variant="ghost" busy={pending} disabled={busy} onPress={() => onCancel(cls)} accessibilityLabel={`Leave waitlist for ${cls.title}`} />;
    } else if (full) {
      action = <ActionButton label="Join waitlist" icon="clock" variant="gold" busy={pending} disabled={busy} onPress={() => onBook(cls)} accessibilityLabel={`Join waitlist for ${cls.title}`} />;
    } else {
      action = <ActionButton label="Book" icon="check" busy={pending} disabled={busy} onPress={() => onBook(cls)} accessibilityLabel={`Book ${cls.title}`} />;
    }
  }

  return (
    <Card style={{ marginBottom: SP.md, padding: 0, overflow: 'hidden', opacity: cancelled ? 0.6 : 1 }}>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: 4, backgroundColor: color }} />
        <View style={{ flex: 1, padding: SP.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: SP.md }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: T.textSub, fontSize: 13, fontWeight: '700' }}>
                {start && end ? formatTimeRange(start, end) : '—'}
              </Text>
              <Text numberOfLines={2} style={{ color: T.text, fontSize: 17, fontWeight: '800', marginTop: 2, letterSpacing: -0.2 }}>{cls.title}</Text>
            </View>
            {pill && <StatusPill label={pill.label} tone={pill.tone} dot />}
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.md, marginTop: SP.sm }}>
            {!!cls.trainerName && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Feather name="user" size={13} color={T.textFaint} />
                <Text style={{ color: T.textSub, fontSize: 13 }}>{cls.trainerName}</Text>
              </View>
            )}
            {!!cls.branchName && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Feather name="map-pin" size={13} color={T.textFaint} />
                <Text style={{ color: T.textSub, fontSize: 13 }}>{cls.branchName}</Text>
              </View>
            )}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SP.md, marginTop: SP.md }}>
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: R.pill,
              backgroundColor: withAlpha(full ? T.brandGold : T.brand, 0.10),
            }}>
              <Feather name="users" size={12} color={full ? T.brandGold : T.brand} />
              <Text style={{ color: full ? T.brandGold : T.brand, fontSize: 12, fontWeight: '700' }}>{spotsText}</Text>
            </View>
            {action}
          </View>
        </View>
      </View>
    </Card>
  );
}

export default function ClassesTab({ userId }: { userId: number }) {
  const toast = useToast();
  // The window is fixed per calendar day so the query key stays stable.
  const today = startOfLocalDay(new Date());
  const fromIso = today.toISOString();
  const toIso = addDays(today, DAYS).toISOString();
  const scheduleQ = useClassSchedule(userId, fromIso, toIso);
  const bookM = useBookClass(userId);
  const cancelM = useCancelClassBooking(userId);
  const [day, setDay] = useState<Date>(today);
  const [pendingId, setPendingId] = useState<number | null>(null);

  const all = scheduleQ.data ?? [];
  const marks = useMemo(() => {
    const s = new Set<number>();
    for (const c of all) {
      const d = parseUtc(c.startsAt);
      if (!d || isClassCancelled(c)) continue;
      const idx = Math.round((startOfLocalDay(d).getTime() - today.getTime()) / 86_400_000);
      if (idx >= 0 && idx < DAYS) s.add(idx);
    }
    return s;
  }, [all, fromIso]);

  const dayClasses = useMemo(
    () => all
      .filter(c => { const d = parseUtc(c.startsAt); return !!d && sameLocalDay(d, day); })
      .sort((a, b) => (parseUtc(a.startsAt)?.getTime() ?? 0) - (parseUtc(b.startsAt)?.getTime() ?? 0)),
    [all, day],
  );

  const book = async (c: GymClass) => {
    setPendingId(c.id);
    try {
      const res = await bookM.mutateAsync(c.id);
      toast.show({ type: 'success', message: res.message || (res.cls.myBooking === 'Waitlisted' ? 'Added to the waitlist.' : 'Booked.') });
    } catch (e) {
      Alert.alert("Couldn't book", apiErrorText(e));
    } finally {
      setPendingId(null);
    }
  };

  const doCancel = async (c: GymClass) => {
    setPendingId(c.id);
    try {
      await cancelM.mutateAsync(c.id);
      toast.show({ type: 'success', message: c.myBooking === 'Waitlisted' ? 'Removed from the waitlist.' : 'Booking cancelled.' });
    } catch (e) {
      Alert.alert("Couldn't cancel", apiErrorText(e));
    } finally {
      setPendingId(null);
    }
  };

  const cancel = (c: GymClass) => {
    const wl = c.myBooking === 'Waitlisted';
    Alert.alert(
      wl ? 'Leave the waitlist?' : 'Cancel this booking?',
      `${c.title}${parseUtc(c.startsAt) ? ` · ${dayLabel(parseUtc(c.startsAt)!)}` : ''}`,
      [
        { text: 'Keep', style: 'cancel' },
        { text: wl ? 'Leave' : 'Cancel booking', style: 'destructive', onPress: () => { void doCancel(c); } },
      ],
    );
  };

  return (
    <View>
      <DayStrip value={day} onChange={setDay} days={DAYS} marks={marks} />
      <Text style={{ color: T.textSub, fontSize: 13, fontWeight: '700', marginTop: SP.lg, marginBottom: SP.md }}>
        {fullDayLabel(day)}
      </Text>

      {scheduleQ.isLoading ? (
        <Skeleton rows={3} height={130} borderRadius={R.xl} gap={SP.md} />
      ) : scheduleQ.isError ? (
        <InlineError error={scheduleQ.error} onRetry={() => scheduleQ.refetch()} />
      ) : dayClasses.length === 0 ? (
        <EmptyState
          icon="calendar"
          title="No classes this day"
          subtitle={marks.size ? 'Pick a day with a dot to see its classes.' : 'No classes are scheduled in the next two weeks.'}
        />
      ) : (
        dayClasses.map(c => (
          <ClassCard
            key={c.id}
            cls={c}
            pending={pendingId === c.id}
            busy={pendingId !== null}
            onBook={book}
            onCancel={cancel}
          />
        ))
      )}
    </View>
  );
}
