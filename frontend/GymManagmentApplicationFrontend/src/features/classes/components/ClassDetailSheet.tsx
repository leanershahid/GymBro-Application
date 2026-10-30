import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import BottomSheet from '../../common/components/BottomSheet';
import PrimaryButton from '../../common/components/PrimaryButton';
import StatusPill from '../../common/components/StatusPill';
import { useToast } from '../../common/components/Toast';
import { Field, SwitchRow } from '../../trainers/components/FormFields';
import { apiErrorText, describeApiError } from '../../../api/apiError';
import { useRoster, useCancelClass, useMarkAttendance, useBookMember, useUnbookMember } from '../api/classesQueries';
import { GymClass, MemberOption, RosterEntry } from '../types/classes.types';
import { fmtDay, fmtTime, MemberPicker, SectionLabel, SmallButton, statusLabel, statusTone } from './classesUi';
import { T, SP, R } from '../../../theme';

export interface ClassDetailSheetProps {
  /** The class to show; null hides the sheet. Pass the latest copy from the schedule query. */
  cls: GymClass | null;
  onClose: () => void;
  /** Opens the edit form for this class. */
  onEdit: (cls: GymClass) => void;
}

type View_ = 'detail' | 'cancel' | 'add';

/** Class details: edit, cancel (one / whole series), roster with attendance, and booking a member. */
export default function ClassDetailSheet({ cls, onClose, onEdit }: ClassDetailSheetProps) {
  const [view, setView] = useState<View_>('detail');
  useEffect(() => { setView('detail'); }, [cls?.id]);

  const title = view === 'cancel' ? 'Cancel class' : view === 'add' ? 'Add member' : (cls?.title ?? 'Class');
  const back = view === 'detail' ? undefined : { label: 'Back', onPress: () => setView('detail') };

  return (
    <BottomSheet visible={!!cls} onClose={onClose} title={title} leftAction={back}>
      {cls && (
        <ScrollView style={{ maxHeight: 660 }} contentContainerStyle={{ padding: SP.xl }} keyboardShouldPersistTaps="handled">
          {view === 'detail' && <Detail cls={cls} onEdit={() => onEdit(cls)} onCancel={() => setView('cancel')} onAdd={() => setView('add')} />}
          {view === 'cancel' && <CancelForm cls={cls} onDone={onClose} />}
          {view === 'add' && <AddMember cls={cls} onDone={() => setView('detail')} />}
        </ScrollView>
      )}
    </BottomSheet>
  );
}

function InfoRow({ icon, text }: { icon: React.ComponentProps<typeof Feather>['name']; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm, marginBottom: 6 }}>
      <Feather name={icon} size={14} color={T.textFaint} />
      <Text style={{ color: T.textSub, fontSize: 14, flex: 1 }}>{text}</Text>
    </View>
  );
}

function Detail({ cls, onEdit, onCancel, onAdd }: { cls: GymClass; onEdit: () => void; onCancel: () => void; onAdd: () => void }) {
  const cancelled = cls.status === 'Cancelled';
  const past = new Date(cls.endsAt).getTime() < Date.now();
  return (
    <View>
      <View style={{ flexDirection: 'row', gap: SP.sm, marginBottom: SP.md, flexWrap: 'wrap' }}>
        <StatusPill label={statusLabel(cls.status)} tone={statusTone(cls.status)} />
        <StatusPill label={cls.classTypeName} tone="neutral" />
        {cls.seriesId != null && <StatusPill label="Weekly series" tone="violet" />}
      </View>
      <InfoRow icon="calendar" text={`${fmtDay(cls.startsAt)} · ${fmtTime(cls.startsAt)} – ${fmtTime(cls.endsAt)}`} />
      <InfoRow icon="user" text={cls.trainerName ?? 'No trainer assigned'} />
      {!!cls.branchName && <InfoRow icon="map-pin" text={cls.branchName} />}
      <InfoRow icon="users" text={`${cls.booked}${cls.capacity != null ? ` / ${cls.capacity}` : ''} booked${cls.waitlisted ? ` · ${cls.waitlisted} waitlisted` : ''}`} />
      {!!cls.notes && <InfoRow icon="file-text" text={cls.notes} />}

      {!cancelled && (
        <View style={{ flexDirection: 'row', gap: SP.sm, marginTop: SP.md, marginBottom: SP.lg, flexWrap: 'wrap' }}>
          {!past && <SmallButton icon="edit-2" label="Edit" onPress={onEdit} />}
          {!past && <SmallButton icon="user-plus" label="Add member" onPress={onAdd} />}
          {!past && <SmallButton icon="x-circle" label="Cancel class" tone={T.err} onPress={onCancel} />}
        </View>
      )}

      <Roster cls={cls} />
    </View>
  );
}

function Roster({ cls }: { cls: GymClass }) {
  const toast = useToast();
  const { data, isLoading, error, refetch } = useRoster(cls.id);
  const attendance = useMarkAttendance();
  const unbook = useUnbookMember();
  const [busy, setBusy] = useState<string | null>(null);
  const cancelled = cls.status === 'Cancelled';
  const started = new Date(cls.startsAt).getTime() <= Date.now();

  const mark = (e: RosterEntry, attended: boolean) => {
    setBusy(`${e.clientId}:${attended ? 'a' : 'n'}`);
    attendance.mutate(
      { id: cls.id, clientId: e.clientId, attended },
      {
        onSuccess: () => { toast.show({ message: `${e.clientName}: ${attended ? 'attended' : 'no-show'}.` }); refetch(); },
        onError: err => Alert.alert('Attendance not saved', apiErrorText(err)),
        onSettled: () => setBusy(null),
      },
    );
  };

  const remove = (e: RosterEntry) => {
    Alert.alert('Remove booking?', `${e.clientName} will be removed from this class.`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: () => {
          setBusy(`${e.clientId}:r`);
          unbook.mutate(
            { id: cls.id, clientId: e.clientId },
            {
              onSuccess: msg => { toast.show({ message: msg || 'Booking cancelled.' }); refetch(); },
              onError: err => Alert.alert('Couldn’t remove', apiErrorText(err)),
              onSettled: () => setBusy(null),
            },
          );
        },
      },
    ]);
  };

  return (
    <View>
      <SectionLabel>Roster</SectionLabel>
      {isLoading ? (
        <ActivityIndicator color={T.brand} style={{ marginVertical: SP.lg }} />
      ) : error ? (
        <View style={{ marginVertical: SP.md }}>
          <Text style={{ color: T.err, fontSize: 13, marginBottom: SP.sm }}>{describeApiError(error).message}</Text>
          <SmallButton icon="refresh-cw" label="Try again" onPress={() => refetch()} />
        </View>
      ) : (data ?? []).length === 0 ? (
        <Text style={{ color: T.textFaint, fontSize: 13, marginVertical: SP.md }}>No bookings yet.</Text>
      ) : (
        (data ?? []).map(e => {
          const waitlisted = e.status === 'Waitlisted';
          const canMark = !cancelled && started && !waitlisted;
          const canRemove = !cancelled && (e.status === 'Booked' || waitlisted);
          return (
            <View key={e.bookingId} style={{
              padding: SP.md, marginBottom: SP.sm, borderRadius: R.md, borderWidth: 1, borderColor: T.line, backgroundColor: T.bgInput,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm }}>
                <Text style={{ flex: 1, color: T.text, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>{e.clientName}</Text>
                <StatusPill label={statusLabel(e.status)} tone={statusTone(e.status)} />
              </View>
              {(canMark || canRemove) && (
                <View style={{ flexDirection: 'row', gap: SP.sm, marginTop: SP.sm, flexWrap: 'wrap' }}>
                  {canMark && e.status !== 'Attended' && (
                    <SmallButton icon="check" label="Attended" tone={T.ok} busy={busy === `${e.clientId}:a`} disabled={!!busy} onPress={() => mark(e, true)} />
                  )}
                  {canMark && e.status !== 'NoShow' && (
                    <SmallButton icon="user-x" label="No-show" tone={T.brandGold} busy={busy === `${e.clientId}:n`} disabled={!!busy} onPress={() => mark(e, false)} />
                  )}
                  {canRemove && (
                    <SmallButton icon="trash-2" label="Remove" tone={T.err} busy={busy === `${e.clientId}:r`} disabled={!!busy} onPress={() => remove(e)} />
                  )}
                </View>
              )}
            </View>
          );
        })
      )}
      {!cancelled && !started && (data ?? []).some(e => e.status !== 'Waitlisted') && (
        <Text style={{ color: T.textFaint, fontSize: 12, marginTop: SP.xs }}>Attendance can be marked once the class starts.</Text>
      )}
    </View>
  );
}

function CancelForm({ cls, onDone }: { cls: GymClass; onDone: () => void }) {
  const toast = useToast();
  const cancel = useCancelClass();
  const [reason, setReason] = useState('');
  const [wholeSeries, setWholeSeries] = useState(false);

  const submit = () => {
    const what = wholeSeries ? 'this and every later class in the series' : 'this class';
    Alert.alert('Cancel class?', `This cancels ${what}. Booked members are released.`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel class', style: 'destructive',
        onPress: () => cancel.mutate(
          { id: cls.id, payload: { reason: reason.trim() || null, wholeSeries } },
          {
            onSuccess: msg => { toast.show({ message: msg || 'Class cancelled.' }); onDone(); },
            onError: e => Alert.alert('Couldn’t cancel', apiErrorText(e)),
          },
        ),
      },
    ]);
  };

  return (
    <View>
      <Text style={{ color: T.textSub, fontSize: 14, marginBottom: SP.lg }}>
        {cls.title} · {fmtDay(cls.startsAt)} {fmtTime(cls.startsAt)}
      </Text>
      <Field label="Reason (optional)" value={reason} onChangeText={setReason} placeholder="e.g. Trainer unwell" multiline />
      {cls.seriesId != null && (
        <SwitchRow label="Cancel the whole series" value={wholeSeries} onValueChange={setWholeSeries}
          description="Also cancels every later class of this weekly series." />
      )}
      <PrimaryButton label={wholeSeries ? 'Cancel series' : 'Cancel this class'} icon="x-circle" variant="danger"
        onPress={submit} loading={cancel.isPending} />
    </View>
  );
}

function AddMember({ cls, onDone }: { cls: GymClass; onDone: () => void }) {
  const toast = useToast();
  const book = useBookMember();
  const [member, setMember] = useState<MemberOption | null>(null);
  const full = cls.capacity != null && cls.booked >= cls.capacity;

  const submit = () => {
    if (!member) return;
    book.mutate(
      { id: cls.id, clientId: member.id },
      {
        onSuccess: msg => { toast.show({ message: `${member.name}: ${msg || 'Booked.'}` }); onDone(); },
        // Membership / already-booked rules come back as a message.
        onError: e => Alert.alert('Booking failed', apiErrorText(e)),
      },
    );
  };

  return (
    <View>
      {full && (
        <Text style={{ color: T.brandGold, fontSize: 13, marginBottom: SP.md }}>
          This class is full — new bookings go on the waitlist.
        </Text>
      )}
      <MemberPicker selected={member} onSelect={setMember} />
      <PrimaryButton label={full ? 'Add to waitlist' : 'Book member'} icon="user-plus" onPress={submit}
        disabled={!member} loading={book.isPending} />
    </View>
  );
}
