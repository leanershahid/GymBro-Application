import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, TextInput, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, R, SP, withAlpha } from '../../../theme';
import { apiErrorText } from '../../../api/apiError';
import Skeleton from '../../common/components/Skeleton';
import EmptyState from '../../dashboard/components/EmptyState';
import { useToast } from '../../common/components/Toast';
import { usePtTypes, useBookPtSession } from '../api/bookingQueries';
import { PtSession, PtType } from '../types/booking.types';
import { formatMoney, formatTime, startOfLocalDay, timeSlots, whenLabel, parseUtc } from '../utils/bookingFormat';
import { Card, SectionTitle, InlineError, ActionButton, DayStrip } from './BookingUi';

interface Props {
  userId: number;
  onOpenBilling?: () => void;
}

function TypeRow({ type, first, selected, onPress }: { type: PtType; first: boolean; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${type.name}, ${type.durationMin} minutes${type.price > 0 ? `, ${formatMoney(type.price, type.currency)}` : ', free'}`}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: SP.md, paddingVertical: SP.md, paddingHorizontal: SP.lg,
        borderTopWidth: first ? 0 : 1, borderTopColor: T.line,
        backgroundColor: selected ? withAlpha(T.brand, 0.10) : pressed ? T.bgInputActive : 'transparent',
      })}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: T.text, fontSize: 15, fontWeight: '700' }}>{type.name}</Text>
        <Text numberOfLines={2} style={{ color: T.textFaint, fontSize: 12, marginTop: 2 }}>
          {type.durationMin} min{type.description ? ` · ${type.description}` : ''}
        </Text>
      </View>
      <Text style={{ color: type.price > 0 ? T.text : T.ok, fontSize: 14, fontWeight: '700' }}>
        {type.price > 0 ? formatMoney(type.price, type.currency) : 'Free'}
      </Text>
      <Feather name={selected ? 'check-circle' : 'chevron-right'} size={18} color={selected ? T.brand : T.textFaint} />
    </Pressable>
  );
}

function SlotGrid({ slots, value, onChange }: { slots: Date[]; value: Date | null; onChange: (d: Date) => void }) {
  if (!slots.length) {
    return <Text style={{ color: T.textSub, fontSize: 13, paddingVertical: SP.md }}>No times left today — pick another day.</Text>;
  }
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm }}>
      {slots.map(s => {
        const selected = !!value && value.getTime() === s.getTime();
        return (
          <Pressable
            key={s.getTime()}
            onPress={() => onChange(s)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={formatTime(s)}
            style={{
              minWidth: 84, minHeight: 40, paddingHorizontal: 10, borderRadius: R.pill, alignItems: 'center', justifyContent: 'center',
              borderWidth: 1, borderColor: selected ? T.brand : T.line, backgroundColor: selected ? T.brand : T.bg,
            }}
          >
            <Text style={{ color: selected ? T.onBrand : T.text, fontSize: 13, fontWeight: '700' }}>{formatTime(s)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function BookedCard({ session, type, onOpenBilling, onDone }: {
  session: PtSession; type: PtType; onOpenBilling?: () => void; onDone: () => void;
}) {
  const start = parseUtc(session.startsAt);
  const priced = type.price > 0;
  return (
    <Card accent={T.brand}>
      <View style={{ alignItems: 'center' }}>
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: withAlpha(T.brand, 0.12), alignItems: 'center', justifyContent: 'center' }}>
          <Feather name="check" size={26} color={T.brand} />
        </View>
        <Text accessibilityRole="header" style={{ color: T.text, fontSize: 18, fontWeight: '800', marginTop: SP.md }}>Session requested</Text>
        <Text style={{ color: T.textSub, fontSize: 14, marginTop: 4, textAlign: 'center' }}>
          {session.sessionTypeName}{session.trainerName ? ` with ${session.trainerName}` : ''}
        </Text>
        {start && <Text style={{ color: T.text, fontSize: 14, fontWeight: '700', marginTop: 2 }}>{whenLabel(start)}</Text>}
      </View>
      {priced && (
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: SP.lg, padding: SP.md, borderRadius: R.md, backgroundColor: withAlpha(T.brandGold, 0.10) }}>
          <Feather name="file-text" size={16} color={T.brandGold} style={{ marginTop: 1 }} />
          <Text style={{ flex: 1, color: T.brandGold, fontSize: 13 }}>
            An invoice for {formatMoney(type.price, type.currency)} was added — pay it in Billing.
          </Text>
        </View>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm, justifyContent: 'center', marginTop: SP.lg }}>
        {priced && onOpenBilling && <ActionButton label="Go to Billing" icon="credit-card" onPress={onOpenBilling} />}
        <ActionButton label="Book another" variant="ghost" onPress={onDone} />
      </View>
    </Card>
  );
}

export default function PtTab({ userId, onOpenBilling }: Props) {
  const toast = useToast();
  const typesQ = usePtTypes(userId);
  const bookM = useBookPtSession(userId);
  const [typeId, setTypeId] = useState<number | null>(null);
  const [day, setDay] = useState<Date>(() => startOfLocalDay(new Date()));
  const [slot, setSlot] = useState<Date | null>(null);
  const [note, setNote] = useState('');
  const [booked, setBooked] = useState<{ session: PtSession; type: PtType } | null>(null);

  const types = useMemo(() => (typesQ.data ?? []).filter(t => t.isActive !== false), [typesQ.data]);
  const groups = useMemo(() => {
    const m = new Map<string, PtType[]>();
    for (const t of types) {
      const k = t.trainerName || 'Trainer';
      m.set(k, [...(m.get(k) ?? []), t]);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [types]);
  const type = types.find(t => t.id === typeId) ?? null;

  const now = Date.now();
  const slots = useMemo(() => timeSlots(day).filter(s => s.getTime() > now), [day, now]);

  const pickType = (t: PtType) => {
    setTypeId(prev => (prev === t.id ? null : t.id));
    setSlot(null);
  };

  const reset = () => {
    setBooked(null); setTypeId(null); setSlot(null); setNote('');
  };

  const confirm = async () => {
    if (!type || !slot) return;
    try {
      const session = await bookM.mutateAsync({ sessionTypeId: type.id, startsAt: slot.toISOString(), notes: note.trim() || null });
      setBooked({ session, type });
      toast.show({ type: 'success', message: 'Session booked.' });
    } catch (e) {
      Alert.alert("Couldn't book", apiErrorText(e));
    }
  };

  if (booked) return <BookedCard session={booked.session} type={booked.type} onOpenBilling={onOpenBilling} onDone={reset} />;
  if (typesQ.isLoading) return <Skeleton rows={3} height={90} borderRadius={R.xl} gap={SP.md} />;
  if (typesQ.isError) return <InlineError error={typesQ.error} onRetry={() => typesQ.refetch()} />;
  if (!types.length) {
    return <EmptyState icon="user-check" title="No sessions available" subtitle="Your gym hasn't set up personal training sessions yet." />;
  }

  return (
    <View>
      <SectionTitle title="Choose a session" />
      {groups.map(([trainer, list]) => (
        <View key={trainer} style={{ marginBottom: SP.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SP.sm }}>
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: withAlpha(T.violet, 0.14), alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: T.violet, fontSize: 12, fontWeight: '800' }}>{trainer.trim().charAt(0).toUpperCase()}</Text>
            </View>
            <Text style={{ color: T.text, fontSize: 14, fontWeight: '700' }}>{trainer}</Text>
          </View>
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {list.map((t, i) => <TypeRow key={t.id} type={t} first={i === 0} selected={t.id === typeId} onPress={() => pickType(t)} />)}
          </Card>
        </View>
      ))}

      {type && (
        <Card accent={T.brand} style={{ marginTop: SP.sm }}>
          <Text style={{ color: T.textSub, fontSize: 11, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' }}>Booking</Text>
          <Text style={{ color: T.text, fontSize: 17, fontWeight: '800', marginTop: 2 }}>{type.name}</Text>
          <Text style={{ color: T.textSub, fontSize: 13, marginTop: 2 }}>
            {type.trainerName ? `with ${type.trainerName} · ` : ''}{type.durationMin} min
            {type.price > 0 ? ` · ${formatMoney(type.price, type.currency)}` : ''}
          </Text>

          <Text style={{ color: T.text, fontSize: 14, fontWeight: '700', marginTop: SP.lg, marginBottom: SP.sm }}>Date</Text>
          <DayStrip value={day} onChange={d => { setDay(d); setSlot(null); }} />

          <Text style={{ color: T.text, fontSize: 14, fontWeight: '700', marginTop: SP.lg, marginBottom: SP.sm }}>Start time</Text>
          <SlotGrid slots={slots} value={slot} onChange={setSlot} />

          <Text style={{ color: T.text, fontSize: 14, fontWeight: '700', marginTop: SP.lg, marginBottom: SP.sm }}>Note (optional)</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Anything your trainer should know?"
            placeholderTextColor={T.textFaint}
            multiline
            maxLength={500}
            accessibilityLabel="Note for your trainer"
            style={{
              minHeight: 72, color: T.text, fontSize: 14, padding: SP.md, borderRadius: R.md,
              borderWidth: 1, borderColor: T.line, backgroundColor: T.bg, textAlignVertical: 'top',
            }}
          />

          <ActionButton
            label={slot ? `Confirm · ${formatTime(slot)}` : 'Pick a time'}
            icon="check"
            onPress={confirm}
            busy={bookM.isPending}
            disabled={!slot}
            style={{ marginTop: SP.lg, minHeight: 48 }}
          />
          {type.price > 0 && (
            <Text style={{ color: T.textFaint, fontSize: 12, marginTop: SP.sm, textAlign: 'center' }}>
              An invoice for {formatMoney(type.price, type.currency)} will be added to your billing.
            </Text>
          )}
        </Card>
      )}
    </View>
  );
}
