import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, R, SP, withAlpha } from '../../../theme';
import FormPage from '../../exercises/components/FormPage';
import { Field } from '../../trainers/components/FormFields';
import { DateField } from '../../trainers/components/DatePicker';
import SearchBar from '../../common/components/SearchBar';
import Skeleton from '../../common/components/Skeleton';
import StatusPill from '../../common/components/StatusPill';
import { useToast } from '../../common/components/Toast';
import EmptyState from '../../dashboard/components/EmptyState';
import { apiErrorText } from '../../../api/apiError';
import { useMyClients, useClientProfiles } from '../api/trainerAppQueries';
import { useAssignWorkout, useAssignPlan } from '../api/programQueries';

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

interface Props {
  kind: 'workout' | 'plan';
  id: number;
  name: string;
  trainerId: number;
  onBack: () => void;
}

/** Assign a workout or plan to one or more of the trainer's own clients. */
export default function AssignPage({ kind, id, name, trainerId, onBack }: Props) {
  const toast = useToast();
  const { data: clients = [], isLoading, isError, error, refetch } = useMyClients(trainerId);
  const profiles = useClientProfiles(clients.map(c => c.clientId));
  const { mutate: assignWorkout, isPending: aw } = useAssignWorkout();
  const { mutate: assignPlan, isPending: ap } = useAssignPlan();

  const [selected, setSelected] = useState<number[]>([]);
  const [search, setSearch] = useState('');
  const [start, setStart] = useState(todayISO());
  const [due, setDue] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<{ clients?: string; due?: string }>({});

  const rows = useMemo(() => clients.map((c, i) => {
    const p = profiles[i]?.data;
    const fullName = p ? `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() : '';
    return { id: c.clientId, status: c.status, name: fullName || p?.email || `Client #${c.clientId}`, email: p?.email ?? '' };
  }), [clients, profiles]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? rows.filter(r => r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q)) : rows;
  }, [rows, search]);

  const toggle = (cid: number) => {
    setSelected(s => (s.includes(cid) ? s.filter(x => x !== cid) : [...s, cid]));
    setErrors(e => ({ ...e, clients: undefined }));
  };
  const allShownSelected = filtered.length > 0 && filtered.every(r => selected.includes(r.id));
  const toggleAll = () => setSelected(s => (allShownSelected
    ? s.filter(x => !filtered.some(r => r.id === x))
    : Array.from(new Set([...s, ...filtered.map(r => r.id)]))));

  const submit = () => {
    const errs: typeof errors = {};
    if (selected.length === 0) errs.clients = 'Pick at least one client.';
    if (kind === 'workout' && due && due < start) errs.due = 'Due date must be on or after the start date.';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const onSuccess = (res: { success: boolean; message: string }) => {
      if (!res.success) { Alert.alert('Could not assign', res.message || 'Nothing was assigned.'); return; }
      toast.show({ type: 'success', message: `${name} assigned to ${selected.length} client${selected.length === 1 ? '' : 's'}.` });
      onBack();
    };
    const onError = (e: unknown) => Alert.alert('Could not assign', apiErrorText(e));

    if (kind === 'workout') {
      assignWorkout({ workoutId: id, memberIds: selected, assignedAt: start, dueDate: due || null, notes: notes.trim() || null }, { onSuccess, onError });
    } else {
      assignPlan({ planId: id, payload: { memberIds: selected, startDate: start } }, { onSuccess, onError });
    }
  };

  return (
    <FormPage
      eyebrow={kind === 'workout' ? 'Assign workout' : 'Assign plan'}
      title={name}
      onBack={onBack}
      submitLabel={selected.length ? `Assign to ${selected.length} client${selected.length === 1 ? '' : 's'}` : 'Assign'}
      onSubmit={submit}
      submitting={aw || ap}
    >
      <DateField label={kind === 'workout' ? 'Start date' : 'Plan start date'} value={start} onChange={setStart} />
      {kind === 'workout' && (
        <>
          <DateField label="Due date (optional)" value={due} onChange={v => { setDue(v); setErrors(e => ({ ...e, due: undefined })); }} placeholder="No due date" error={errors.due} />
          {!!due && (
            <Pressable onPress={() => setDue('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear due date" style={{ alignSelf: 'flex-start', marginTop: -8, marginBottom: SP.lg, minHeight: 32, justifyContent: 'center' }}>
              <Text style={{ color: T.brand, fontSize: 13, fontWeight: '600' }}>Clear due date</Text>
            </Pressable>
          )}
          <Field label="Notes for the client (optional)" value={notes} onChangeText={setNotes} placeholder="e.g. Focus on form this week" multiline />
        </>
      )}

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SP.sm, marginTop: SP.sm }}>
        <Text style={{ color: T.textSub, fontSize: 13 }}>Clients{selected.length ? ` · ${selected.length} selected` : ''}</Text>
        {filtered.length > 1 && (
          <Pressable onPress={toggleAll} hitSlop={8} accessibilityRole="button" accessibilityLabel={allShownSelected ? 'Deselect all shown clients' : 'Select all shown clients'} style={{ minHeight: 32, justifyContent: 'center' }}>
            <Text style={{ color: T.brand, fontSize: 13, fontWeight: '600' }}>{allShownSelected ? 'Deselect all' : 'Select all'}</Text>
          </Pressable>
        )}
      </View>
      {!!errors.clients && <Text style={{ color: T.err, fontSize: 12, marginBottom: SP.sm }}>{errors.clients}</Text>}

      {clients.length > 5 && (
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search clients…" label="Search clients" style={{ marginBottom: SP.md }} />
      )}

      {isLoading && <Skeleton rows={3} height={56} />}
      {isError && <EmptyState icon="wifi-off" tone="error" title="Couldn't load your clients" subtitle={apiErrorText(error)} action={{ label: 'Retry', onPress: () => refetch() }} />}
      {!isLoading && !isError && filtered.length === 0 && (
        <EmptyState icon="users" title={search ? 'No matching clients' : 'No clients assigned to you yet'} subtitle={search ? undefined : 'You can only assign programs to your own clients.'} />
      )}
      {!isLoading && !isError && filtered.map(r => {
        const on = selected.includes(r.id);
        return (
          <Pressable
            key={r.id}
            onPress={() => toggle(r.id)}
            accessibilityRole="checkbox"
            accessibilityLabel={r.name}
            accessibilityState={{ checked: on }}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: SP.md, minHeight: 56, paddingHorizontal: SP.md, paddingVertical: SP.sm,
              marginBottom: SP.sm, borderRadius: R.md,
              backgroundColor: on ? withAlpha(T.brand, 0.10) : T.bgInput,
              borderWidth: 1, borderColor: on ? withAlpha(T.brand, 0.4) : T.line,
            }}
          >
            <View style={{
              width: 24, height: 24, borderRadius: 6, alignItems: 'center', justifyContent: 'center',
              backgroundColor: on ? T.brand : 'transparent', borderWidth: 1.5, borderColor: on ? T.brand : T.textFaint,
            }}>
              {on && <Feather name="check" size={14} color={T.onBrand} />}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ color: T.text, fontSize: 14, fontWeight: '700' }}>{r.name}</Text>
              {!!r.email && r.email !== r.name && <Text numberOfLines={1} style={{ color: T.textFaint, fontSize: 12, marginTop: 2 }}>{r.email}</Text>}
            </View>
            {!!r.status && <StatusPill label={r.status} />}
          </Pressable>
        );
      })}
    </FormPage>
  );
}
