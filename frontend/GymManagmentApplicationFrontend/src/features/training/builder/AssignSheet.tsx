import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, R, SP, withAlpha } from '../../../theme';
import FormPage from '../../common/components/FormPage';
import { DateField } from '../../common/components/DatePicker';
import SearchBar from '../../common/components/SearchBar';
import Skeleton from '../../common/components/Skeleton';
import EmptyState from '../../common/components/EmptyState';
import PrimaryButton from '../../common/components/PrimaryButton';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import { confirm, showAlert } from '../../common/components/dialogs';
import { formatDate } from '../../common/utils/format';
import { apiErrorText } from '../../../api/apiError';
import { useMyClients, useClientProfiles } from '../../trainer-app/api/trainerAppQueries';
import { useMembers } from '../../members/api/memberQueries';
import { useAssignPlan } from '../api/trainingQueries';
import type { ActivePlanConflict, PlanBuilder } from '../api/training.types';
import { CheckRow, Chip, SectionLabel } from './BuilderUi';
import { WEEKDAYS } from './builderUtils';

/** Who is assigning: a trainer picks from their own clients, an admin searches all members. */
export type Assigner = { kind: 'trainer'; trainerId: number } | { kind: 'admin' };

interface Props {
  plan: PlanBuilder;
  assigner: Assigner;
  onBack: () => void;
  /** "See members" after assigning. */
  onOpenMembers: () => void;
}

interface PickRow { id: number; name: string; sub: string | null }

export const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** Plan day (1 = Monday … 7 = Sunday) of a yyyy-MM-dd date. */
export const weekdayNumber = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  const wd = new Date(y, (m || 1) - 1, d || 1).getDay();
  return wd === 0 ? 7 : wd;
};

const conflictText = (c: ActivePlanConflict[]) => c.map(x => `• ${x.clientName ?? `Member #${x.clientId}`} — ${x.planName} (since ${formatDate(x.startDate)})`).join('\n');

/** Assign a master plan: members, start date, start position; handles 409 PLAN_ALREADY_ACTIVE. */
export default function AssignSheet({ plan, assigner, onBack, onOpenMembers }: Props) {
  const assign = useAssignPlan(plan.planId);
  const [selected, setSelected] = useState<Map<number, string>>(new Map());
  const [start, setStart] = useState(isoDate(new Date()));
  const [startWeek, setStartWeek] = useState(1);
  const [startDay, setStartDay] = useState(1);
  const [error, setError] = useState<string | undefined>();
  const [done, setDone] = useState<number | null>(null);

  const toggle = (r: PickRow) => {
    setSelected(s => { const n = new Map(s); if (n.has(r.id)) n.delete(r.id); else n.set(r.id, r.name); return n; });
    setError(undefined);
  };

  const send = async (replaceExisting: boolean) => {
    const memberIds = Array.from(selected.keys());
    try {
      const r = await assign.mutateAsync({ memberIds, startDate: start, startWeek, startDay, replaceExisting });
      if ('conflicts' in r) {
        const ok = await confirm({
          title: r.conflicts.length === 1 ? 'Already on a plan' : `${r.conflicts.length} members are already on a plan`,
          message: `${conflictText(r.conflicts)}\n\nReplacing ends their current plan today.`,
          confirmLabel: 'Replace current plan', destructive: true,
        });
        if (ok) await send(true);
        return;
      }
      setDone(r.assigned.length || memberIds.length);
    } catch (e) {
      showAlert('Could not assign', apiErrorText(e));
    }
  };

  const submit = () => {
    if (selected.size === 0) { setError(assigner.kind === 'trainer' ? 'Pick at least one client.' : 'Pick at least one member.'); return; }
    send(false);
  };

  if (done !== null) {
    return (
      <Screen>
        <ScreenHeader eyebrow="Assigned" title={plan.name} onBack={onBack} />
        <View style={{ padding: SP.xl, alignItems: 'center', gap: SP.lg }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: withAlpha(T.brand, 0.12) }}>
            <Feather name="check" size={30} color={T.brand} />
          </View>
          <Text style={{ color: T.text, fontSize: 20, fontWeight: '800', textAlign: 'center' }}>Assigned to {done} member{done === 1 ? '' : 's'}</Text>
          <Text style={{ color: T.textSub, fontSize: 13, textAlign: 'center' }}>
            Each member got their own copy starting {formatDate(start)} (week {startWeek}, {WEEKDAYS[startDay - 1]}). Edits to this plan no longer change their copies.
          </Text>
          <PrimaryButton label="See plan members" icon="users" onPress={onOpenMembers} style={{ alignSelf: 'stretch' }} />
          <PrimaryButton label="Back to plan" variant="secondary" onPress={onBack} style={{ alignSelf: 'stretch' }} />
        </View>
      </Screen>
    );
  }

  return (
    <FormPage
      eyebrow="Assign plan"
      title={plan.name}
      onBack={onBack}
      submitLabel={selected.size ? `Assign to ${selected.size} member${selected.size === 1 ? '' : 's'}` : 'Assign'}
      onSubmit={submit}
      submitting={assign.isPending}
    >
      <DateField label="Start date" value={start} onChange={setStart} />
      <SectionLabel>Start at week</SectionLabel>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: SP.md }}>
        {plan.weeks.map(w => <Chip key={w.weekNumber} small label={`W${w.weekNumber}`} active={startWeek === w.weekNumber} a11y={`Start at week ${w.weekNumber}`} onPress={() => setStartWeek(w.weekNumber)} />)}
      </ScrollView>
      <SectionLabel>Start at day</SectionLabel>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: SP.sm }}>
        {WEEKDAYS.map((d, i) => <Chip key={d} small label={d} active={startDay === i + 1} a11y={`Start at ${d}`} onPress={() => setStartDay(i + 1)} />)}
      </View>
      <Text style={{ color: T.textFaint, fontSize: 12, marginBottom: SP.lg }}>
        {startWeek === 1 && startDay === 1 ? `Starts at the beginning of the plan on ${formatDate(start)}.` : `On ${formatDate(start)} the member is on week ${startWeek}, ${WEEKDAYS[startDay - 1]} (earlier days are skipped).`}
        {startDay !== weekdayNumber(start) ? ` Plan days are labelled Mon–Sun; this start puts plan ${WEEKDAYS[startDay - 1]} on a ${WEEKDAYS[weekdayNumber(start) - 1]}.` : ''}
      </Text>

      <SectionLabel>{assigner.kind === 'trainer' ? 'Clients' : 'Members'}{selected.size ? ` · ${selected.size} selected` : ''}</SectionLabel>
      {!!error && <Text style={{ color: T.err, fontSize: 12, marginBottom: SP.sm }}>{error}</Text>}
      {selected.size > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: SP.md }}>
          {Array.from(selected.entries()).map(([id, name]) => (
            <Pressable key={id} onPress={() => toggle({ id, name, sub: null })} accessibilityRole="button" accessibilityLabel={`Remove ${name}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, minHeight: 30, borderRadius: R.pill, backgroundColor: withAlpha(T.brand, 0.12), borderWidth: 1, borderColor: withAlpha(T.brand, 0.35) }}>
              <Text style={{ color: T.brand, fontSize: 12, fontWeight: '700' }}>{name}</Text>
              <Feather name="x" size={12} color={T.brand} />
            </Pressable>
          ))}
        </View>
      )}
      {assigner.kind === 'trainer'
        ? <TrainerClientPicker trainerId={assigner.trainerId} selected={selected} onToggle={toggle} />
        : <MemberSearchPicker selected={selected} onToggle={toggle} />}
    </FormPage>
  );
}

function PickList({ rows, selected, onToggle, loading, error, retry, emptyTitle, emptySub }: {
  rows: PickRow[]; selected: Map<number, string>; onToggle: (r: PickRow) => void; loading: boolean; error: unknown; retry: () => void;
  emptyTitle: string; emptySub?: string;
}) {
  if (loading) return <Skeleton rows={3} height={52} />;
  if (error) return <EmptyState icon="wifi-off" tone="error" title="Couldn't load the list" subtitle={apiErrorText(error)} action={{ label: 'Retry', onPress: retry }} />;
  if (!rows.length) return <EmptyState icon="users" title={emptyTitle} subtitle={emptySub} />;
  return <>{rows.map(r => <CheckRow key={r.id} label={r.name} sub={r.sub} checked={selected.has(r.id)} onPress={() => onToggle(r)} />)}</>;
}

function TrainerClientPicker({ trainerId, selected, onToggle }: { trainerId: number; selected: Map<number, string>; onToggle: (r: PickRow) => void }) {
  const { data: clients = [], isLoading, error, refetch } = useMyClients(trainerId);
  const profiles = useClientProfiles(clients.map(c => c.clientId));
  const [search, setSearch] = useState('');
  const rows = useMemo(() => clients.map((c, i) => {
    const p = profiles[i]?.data;
    const name = p ? `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() : '';
    return { id: c.clientId, name: name || p?.email || `Client #${c.clientId}`, sub: p?.email ?? null };
  }), [clients, profiles]);
  const q = search.trim().toLowerCase();
  const shown = q ? rows.filter(r => r.name.toLowerCase().includes(q) || (r.sub ?? '').toLowerCase().includes(q)) : rows;
  return (
    <>
      {clients.length > 5 && <SearchBar value={search} onChangeText={setSearch} placeholder="Search clients…" label="Search clients" style={{ marginBottom: SP.md }} />}
      <PickList rows={shown} selected={selected} onToggle={onToggle} loading={isLoading} error={error} retry={() => refetch()}
        emptyTitle={q ? 'No matching clients' : 'No clients assigned to you yet'} emptySub={q ? undefined : 'You can only assign plans to your own clients.'} />
    </>
  );
}

function MemberSearchPicker({ selected, onToggle }: { selected: Map<number, string>; onToggle: (r: PickRow) => void }) {
  const [search, setSearch] = useState('');
  const { data, isLoading, error, refetch } = useMembers(search.trim(), 1, 30);
  const rows = (data?.items ?? []).map(m => ({ id: m.id, name: `${m.firstName ?? ''} ${m.lastName ?? ''}`.trim() || m.email, sub: m.email }));
  return (
    <>
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search members by name, email or phone…" label="Search members" style={{ marginBottom: SP.md }} />
      <PickList rows={rows} selected={selected} onToggle={onToggle} loading={isLoading} error={error} retry={() => refetch()}
        emptyTitle={search ? 'No matching members' : 'No members yet'} />
    </>
  );
}
