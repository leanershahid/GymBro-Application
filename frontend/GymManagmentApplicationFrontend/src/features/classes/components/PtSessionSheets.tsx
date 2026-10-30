import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import BottomSheet from '../../common/components/BottomSheet';
import PrimaryButton from '../../common/components/PrimaryButton';
import LoadingState from '../../common/components/LoadingState';
import StatusPill from '../../common/components/StatusPill';
import { useToast } from '../../common/components/Toast';
import ChipSelect from '../../exercises/components/ChipSelect';
import { Field, RowGrid, GridCell } from '../../trainers/components/FormFields';
import { DateField } from '../../trainers/components/DatePicker';
import { TimeField } from '../../trainers/components/TimePicker';
import { apiErrorText, describeApiError } from '../../../api/apiError';
import { usePtTypes, useTrainerOptions, useMyTrainerProfile, useBookPt, useUpdatePtStatus } from '../api/classesQueries';
import { MemberOption, PtSession, PtStatusInput } from '../types/classes.types';
import { MemberPicker, SmallButton, fmtDay, fmtMoney, fmtTime, localDateKey, statusLabel, statusTone, toUtcIso } from './classesUi';
import { T, SP } from '../../../theme';

// ─── Session detail / status actions ─────────────────────────────

export interface PtSessionSheetProps {
  session: PtSession | null;
  onClose: () => void;
  mode: 'admin' | 'trainer';
}

const ACTION_COPY: Record<PtStatusInput, { label: string; done: string; confirm?: string }> = {
  confirmed: { label: 'Confirm', done: 'Session confirmed.' },
  completed: { label: 'Complete', done: 'Session completed.' },
  noshow:    { label: 'No-show', done: 'Marked as no-show.', confirm: 'Mark this member as a no-show?' },
  cancelled: { label: 'Cancel session', done: 'Session cancelled.', confirm: 'Cancel this session? Any unpaid invoice for it is voided.' },
};

export function PtSessionSheet({ session, onClose, mode }: PtSessionSheetProps) {
  const toast = useToast();
  const update = useUpdatePtStatus();
  const [notes, setNotes] = useState('');
  const [pending, setPending] = useState<PtStatusInput | null>(null);

  useEffect(() => { setNotes(session?.trainerNotes ?? ''); }, [session?.id]);

  const s = session;
  const status = s?.status ?? '';
  const open = status === 'Booked' || status === 'Confirmed' || status === 'InProgress';
  const started = s ? new Date(s.startsAt).getTime() <= Date.now() : false;

  const run = (target: PtStatusInput) => {
    if (!s) return;
    const go = () => {
      setPending(target);
      update.mutate(
        { id: s.id, payload: { status: target, trainerNotes: notes.trim() || null } },
        {
          onSuccess: () => { toast.show({ message: ACTION_COPY[target].done }); onClose(); },
          onError: e => Alert.alert('Session not updated', apiErrorText(e)),
          onSettled: () => setPending(null),
        },
      );
    };
    const c = ACTION_COPY[target].confirm;
    if (c) Alert.alert(ACTION_COPY[target].label, c, [{ text: 'Back', style: 'cancel' }, { text: ACTION_COPY[target].label, style: 'destructive', onPress: go }]);
    else go();
  };

  return (
    <BottomSheet visible={!!s} onClose={onClose} title={s?.sessionTypeName ?? 'Session'}>
      {s && (
        <ScrollView style={{ maxHeight: 640 }} contentContainerStyle={{ padding: SP.xl }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: 'row', gap: SP.sm, marginBottom: SP.md }}>
            <StatusPill label={statusLabel(status)} tone={statusTone(status)} />
            {s.price != null && <StatusPill label={fmtMoney(s.price, s.currency)} tone="neutral" />}
          </View>
          <Info icon="calendar" text={`${fmtDay(s.startsAt)} · ${fmtTime(s.startsAt)} – ${fmtTime(s.endsAt)}`} />
          <Info icon="user" text={s.clientName ?? `Member #${s.clientId}`} />
          {mode === 'admin' && <Info icon="award" text={s.trainerName ?? 'Trainer'} />}
          {!!s.notes && <Info icon="message-square" text={s.notes} />}
          {s.rating != null && <Info icon="star" text={`Rated ${s.rating}/5`} />}

          {open ? (
            <View style={{ marginTop: SP.md }}>
              <Field label="Trainer notes" value={notes} onChangeText={setNotes} multiline placeholder="What you worked on, next steps…" />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm }}>
                {status === 'Booked' && (
                  <SmallButton icon="check-circle" label="Confirm" onPress={() => run('confirmed')} busy={pending === 'confirmed'} disabled={!!pending} />
                )}
                <SmallButton icon="award" label="Complete" tone={T.ok} onPress={() => run('completed')}
                  busy={pending === 'completed'} disabled={!!pending || !started} />
                <SmallButton icon="user-x" label="No-show" tone={T.brandGold} onPress={() => run('noshow')}
                  busy={pending === 'noshow'} disabled={!!pending || !started} />
                <SmallButton icon="x-circle" label="Cancel" tone={T.err} onPress={() => run('cancelled')}
                  busy={pending === 'cancelled'} disabled={!!pending} />
              </View>
              {!started && (
                <Text style={{ color: T.textFaint, fontSize: 12, marginTop: SP.sm }}>Complete and no-show unlock once the session starts.</Text>
              )}
            </View>
          ) : (
            !!s.trainerNotes && <Info icon="edit-3" text={s.trainerNotes} />
          )}
        </ScrollView>
      )}
    </BottomSheet>
  );
}

function Info({ icon, text }: { icon: React.ComponentProps<typeof Feather>['name']; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm, marginBottom: 6 }}>
      <Feather name={icon} size={14} color={T.textFaint} />
      <Text style={{ color: T.textSub, fontSize: 14, flex: 1 }}>{text}</Text>
    </View>
  );
}

// ─── Book a session for a member ─────────────────────────────────

export interface PtBookSheetProps {
  visible: boolean;
  onClose: () => void;
  mode: 'admin' | 'trainer';
}

export function PtBookSheet({ visible, onClose, mode }: PtBookSheetProps) {
  const toast = useToast();
  const isAdmin = mode === 'admin';
  const trainers = useTrainerOptions(isAdmin && visible);
  const mine = useMyTrainerProfile(!isAdmin && visible);
  const [trainerId, setTrainerId] = useState<number | null>(null);
  const typeTrainer = isAdmin ? trainerId : mine.me?.id ?? null;
  const types = usePtTypes(typeTrainer, visible && (isAdmin ? !!trainerId : !mine.isLoading));
  const book = useBookPt();

  const [typeId, setTypeId] = useState<number | null>(null);
  const [member, setMember] = useState<MemberOption | null>(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!visible) return;
    setTrainerId(null); setTypeId(null); setMember(null);
    setDate(localDateKey(new Date())); setTime(''); setNotes(''); setErrors({});
  }, [visible]);
  useEffect(() => { setTypeId(null); }, [trainerId]);

  const activeTypes = (types.data ?? []).filter(t => t.isActive);
  const chosen = activeTypes.find(t => t.id === typeId);

  const submit = () => {
    const errs: Record<string, string> = {};
    if (isAdmin && !trainerId) errs.trainer = 'Choose a trainer.';
    if (!typeId) errs.type = 'Choose a session type.';
    if (!member) errs.member = 'Choose a member.';
    const startsAt = date && time ? toUtcIso(date, time) : null;
    if (!date) errs.date = 'Pick a date.';
    if (!time) errs.time = 'Pick a start time.';
    else if (!startsAt) errs.time = 'Invalid date or time.';
    else if (new Date(startsAt).getTime() < Date.now()) errs.time = 'Pick a time in the future.';
    setErrors(errs);
    if (Object.keys(errs).length || !startsAt) return;
    book.mutate(
      { sessionTypeId: typeId!, clientId: member!.id, startsAt, notes: notes.trim() || null },
      {
        onSuccess: () => { toast.show({ message: `Session booked for ${member!.name}.` }); onClose(); },
        // Trainer clashes, time off and member double-booking come back as a message.
        onError: e => Alert.alert('Session not booked', apiErrorText(e)),
      },
    );
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Book PT session" leftAction={{ label: 'Cancel', onPress: onClose }}>
      <ScrollView style={{ maxHeight: 660 }} contentContainerStyle={{ padding: SP.xl }} keyboardShouldPersistTaps="handled">
        {isAdmin && (
          trainers.isLoading ? <LoadingState label="Loading trainers…" /> :
          trainers.error ? <Text style={{ color: T.err, marginBottom: SP.md }}>{describeApiError(trainers.error).message}</Text> : (
            <ChipSelect<number> label="Trainer" options={(trainers.data ?? []).map(t => ({ value: t.id, label: t.name }))}
              value={trainerId} onChange={setTrainerId} error={errors.trainer} />
          )
        )}

        {(!isAdmin || trainerId) && (
          types.isLoading || (!isAdmin && mine.isLoading) ? <LoadingState label="Loading session types…" /> :
          types.error ? <Text style={{ color: T.err, marginBottom: SP.md }}>{describeApiError(types.error).message}</Text> :
          activeTypes.length === 0 ? (
            <Text style={{ color: T.textSub, marginBottom: SP.md }}>
              No active session types{isAdmin ? ' for this trainer' : ''}. Create one in the "Session types" tab.
            </Text>
          ) : (
            <ChipSelect<number> label="Session type"
              options={activeTypes.map(t => ({ value: t.id, label: `${t.name} · ${t.durationMin}m · ${fmtMoney(t.price, t.currency)}` }))}
              value={typeId} onChange={setTypeId} error={errors.type} />
          )
        )}

        <MemberPicker selected={member} onSelect={setMember} />
        {!!errors.member && <Text style={{ color: T.err, fontSize: 12, marginTop: -SP.sm, marginBottom: SP.md }}>{errors.member}</Text>}

        <RowGrid>
          <GridCell><DateField label="Date" value={date} onChange={setDate} error={errors.date} /></GridCell>
          <GridCell>
            <TimeField label="Start time" value={time} onChange={setTime} />
            {!!errors.time && <Text style={{ color: T.err, fontSize: 12, marginTop: -8, marginBottom: SP.md }}>{errors.time}</Text>}
          </GridCell>
        </RowGrid>
        <Field label="Notes (optional)" value={notes} onChangeText={setNotes} multiline />
        {chosen && chosen.price > 0 && (
          <Text style={{ color: T.textFaint, fontSize: 12, marginBottom: SP.md }}>
            An invoice for {fmtMoney(chosen.price, chosen.currency)} is raised for the member.
          </Text>
        )}
        <PrimaryButton label="Book session" icon="calendar" onPress={submit} loading={book.isPending} />
      </ScrollView>
    </BottomSheet>
  );
}
