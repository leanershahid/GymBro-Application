import React, { useMemo, useState } from 'react';
import { View, Text,} from 'react-native';
import { showAlert } from '../../common/components/dialogs';
import { Feather } from '@expo/vector-icons';
import { T, R, SP, withAlpha } from '../../../theme';
import { apiErrorText } from '../../../api/apiError';
import StatusPill, { PillTone } from '../../common/components/StatusPill';
import Skeleton from '../../common/components/Skeleton';
import EmptyState from '../../common/components/EmptyState';
import { useToast } from '../../common/components/Toast';
import {
  useMyClasses, useMyPtSessions, useRatePtSession,
} from '../api/bookingQueries';
import { PtSession, UpcomingItem } from '../types/booking.types';
import {
  upcomingItems, pastPtSessions, whenLabel, formatTimeRange, parseUtc, classColor, dayLabel, formatMoney,
} from '../utils/bookingFormat';
import { Card, SectionTitle, InlineError, ActionButton, StarRating } from './BookingUi';
import { BookingPolicy, BookingStandingCard, cancelRuleText } from '../../booking-rules/routes';
import { useCancelFlow } from '../hooks/useCancelFlow';

function ptTone(status: string): PillTone {
  switch (status.toLowerCase()) {
    case 'confirmed': return 'ok';
    case 'booked': return 'info';
    case 'completed': return 'brand';
    case 'cancelled': return 'err';
    case 'noshow': return 'err';
    default: return 'neutral';
  }
}
const ptLabel = (status: string) => (status.toLowerCase() === 'booked' ? 'Requested' : status === 'NoShow' ? 'Missed' : status);

function UpcomingRow({ item, pending, busy, policy, onCancel }: {
  item: UpcomingItem; pending: boolean; busy: boolean; policy?: BookingPolicy; onCancel: (i: UpcomingItem) => void;
}) {
  const isClass = item.kind === 'class';
  const accent = isClass ? classColor(item.cls) : T.violet;
  const title = isClass ? item.cls.title : item.session.sessionTypeName;
  const trainer = isClass ? item.cls.trainerName : item.session.trainerName;
  const pill = isClass
    ? (item.cls.myBooking === 'Waitlisted' ? { label: 'Waitlisted', tone: 'warn' as PillTone } : { label: 'Booked', tone: 'ok' as PillTone })
    : { label: ptLabel(item.session.status), tone: ptTone(item.session.status) };
  const started = item.startsAt.getTime() <= Date.now();
  const waitlisted = isClass && item.cls.myBooking === 'Waitlisted';
  const rule = !started && !waitlisted ? cancelRuleText(isClass ? item.cls.freeCancelUntil : item.session.freeCancelUntil, policy) : null;

  return (
    <Card accent={accent} style={{ marginBottom: SP.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: SP.md }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: withAlpha(accent, 0.12), alignItems: 'center', justifyContent: 'center' }}>
          <Feather name={isClass ? 'users' : 'user-check'} size={18} color={accent} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: T.textSub, fontSize: 11, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' }}>
            {isClass ? 'Class' : 'Personal training'}
          </Text>
          <Text numberOfLines={2} style={{ color: T.text, fontSize: 16, fontWeight: '800', marginTop: 2 }}>{title}</Text>
          <Text style={{ color: T.textSub, fontSize: 13, marginTop: 2 }}>
            {dayLabel(item.startsAt)} · {formatTimeRange(item.startsAt, item.endsAt)}
          </Text>
          {!!trainer && <Text style={{ color: T.textFaint, fontSize: 12, marginTop: 2 }}>with {trainer}</Text>}
        </View>
        <StatusPill label={pill.label} tone={pill.tone} dot />
      </View>
      {!started && (
        <View style={{ flexDirection: 'row', justifyContent: rule ? 'space-between' : 'flex-end', alignItems: 'center', gap: SP.md, marginTop: SP.md }}>
          {!!rule && <Text style={{ color: T.textFaint, fontSize: 12, flexShrink: 1 }}>{rule}</Text>}
          <ActionButton
            label={isClass && item.cls.myBooking === 'Waitlisted' ? 'Leave waitlist' : 'Cancel'}
            icon="x"
            variant="danger"
            busy={pending}
            disabled={busy}
            onPress={() => onCancel(item)}
            accessibilityLabel={`Cancel ${title}`}
          />
        </View>
      )}
    </Card>
  );
}

function PastPtRow({ s, first, rating, onRate }: {
  s: PtSession; first: boolean; rating: boolean; onRate: (s: PtSession, n: number) => void;
}) {
  const start = parseUtc(s.startsAt);
  const canRate = s.status === 'Completed' && s.rating == null;
  return (
    <View style={{ paddingVertical: SP.md, paddingHorizontal: SP.lg, borderTopWidth: first ? 0 : 1, borderTopColor: T.line }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ color: T.text, fontSize: 14, fontWeight: '600' }}>{s.sessionTypeName}</Text>
          <Text numberOfLines={1} style={{ color: T.textFaint, fontSize: 12, marginTop: 2 }}>
            {start ? whenLabel(start) : ''}{s.trainerName ? ` · ${s.trainerName}` : ''}
            {s.price ? ` · ${formatMoney(s.price, s.currency)}` : ''}
          </Text>
        </View>
        <StatusPill label={ptLabel(s.status)} tone={ptTone(s.status)} />
      </View>
      {canRate && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SP.md, marginTop: SP.md, padding: SP.md, borderRadius: R.md, backgroundColor: withAlpha(T.brandGold, 0.08) }}>
          <Text style={{ color: T.text, fontSize: 13, fontWeight: '600', flexShrink: 1 }}>How was it?</Text>
          <StarRating value={0} onRate={n => onRate(s, n)} disabled={rating} />
        </View>
      )}
      {s.rating != null && (
        <View style={{ marginTop: SP.sm }}>
          <StarRating value={s.rating} size={14} />
        </View>
      )}
    </View>
  );
}

export default function MyBookingsTab({ userId, onContactGym }: { userId: number; onContactGym?: () => void }) {
  const toast = useToast();
  const classesQ = useMyClasses(userId);
  const ptQ = useMyPtSessions(userId);
  const cancelFlow = useCancelFlow(userId);
  const rateM = useRatePtSession(userId);
  const [ratingId, setRatingId] = useState<number | null>(null);

  const upcoming = useMemo(() => upcomingItems(classesQ.data ?? [], ptQ.data ?? []), [classesQ.data, ptQ.data]);
  const past = useMemo(() => pastPtSessions(ptQ.data ?? []).slice(0, 20), [ptQ.data]);

  const cancel = (item: UpcomingItem) => {
    const title = `${item.kind === 'class' ? item.cls.title : item.session.sessionTypeName} · ${whenLabel(item.startsAt)}`;
    if (item.kind === 'class') {
      cancelFlow.request({
        kind: 'class', id: item.cls.id, title, startsAt: item.cls.startsAt,
        freeCancelUntil: item.cls.freeCancelUntil, waitlisted: item.cls.myBooking === 'Waitlisted',
      });
    } else {
      cancelFlow.request({
        kind: 'pt', id: item.session.id, title, startsAt: item.session.startsAt, freeCancelUntil: item.session.freeCancelUntil,
        extra: item.session.invoiceId ? 'An unpaid invoice for this session will be voided.' : undefined,
      });
    }
  };

  const rate = async (s: PtSession, n: number) => {
    setRatingId(s.id);
    try {
      await rateM.mutateAsync({ sessionId: s.id, rating: n });
      toast.show({ type: 'success', message: 'Thanks for rating!' });
    } catch (e) {
      showAlert("Couldn't save rating", apiErrorText(e));
    } finally {
      setRatingId(null);
    }
  };

  const loading = classesQ.isLoading || ptQ.isLoading;
  const bothFailed = classesQ.isError && ptQ.isError;

  if (loading) return <Skeleton rows={3} height={110} borderRadius={R.xl} gap={SP.md} />;
  if (bothFailed) return <InlineError error={classesQ.error} onRetry={() => { classesQ.refetch(); ptQ.refetch(); }} />;

  return (
    <View>
      <BookingStandingCard userId={userId} onContactGym={onContactGym} />
      <SectionTitle title="Upcoming" right={upcoming.length ? <Text style={{ color: T.textSub, fontSize: 13, fontWeight: '700' }}>{upcoming.length}</Text> : undefined} />
      {(classesQ.isError || ptQ.isError) && (
        <InlineError error={classesQ.error ?? ptQ.error} onRetry={() => { classesQ.refetch(); ptQ.refetch(); }} />
      )}
      {upcoming.length === 0 ? (
        <Card style={{ marginBottom: SP.md }}>
          <EmptyState icon="calendar" title="Nothing booked yet" subtitle="Book a class or a personal training session to see it here." />
        </Card>
      ) : upcoming.map(item => (
        <UpcomingRow key={item.key} item={item} pending={cancelFlow.pendingKey === item.key} busy={cancelFlow.pendingKey !== null}
          policy={cancelFlow.policy} onCancel={cancel} />
      ))}

      {past.length > 0 && (
        <View style={{ marginTop: SP.xl }}>
          <SectionTitle title="Past PT sessions" />
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {past.map((s, i) => (
              <PastPtRow key={s.id} s={s} first={i === 0} rating={ratingId === s.id} onRate={rate} />
            ))}
          </Card>
        </View>
      )}
      {cancelFlow.sheet}
    </View>
  );
}
