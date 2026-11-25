import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { T, R, SP, withAlpha } from '../../../theme';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import { SmallButton } from '../../common/components/SmallButton';
import StatusPill from '../../common/components/StatusPill';
import Skeleton from '../../common/components/Skeleton';
import EmptyState from '../../common/components/EmptyState';
import { useToast } from '../../common/components/Toast';
import { confirm, showAlert } from '../../common/components/dialogs';
import { difficultyTone, goalTone } from '../../common/constants/statusColors';
import { formatDate } from '../../common/utils/format';
import { apiErrorText } from '../../../api/apiError';
import { useLayout } from '../../../utils/useLayout';
import {
  usePlanBuilder, useClientPlanBuilder, useBuilderActions, useUpdatePlan, useDuplicatePlan,
} from '../api/trainingQueries';
import type { BuilderDay, PlanBuilder, PlanDayRef } from '../api/training.types';
import DayCard from './DayCard';
import DayEditor from './DayEditor';
import AssignSheet, { Assigner } from './AssignSheet';
import { PlanMembersSheet, ClientScheduleSheet } from './PlanMembersSheet';
import { DayCopySheet, WeekCopySheet, LibraryWorkoutSheet, RenameSheet, PlanDetailsSheet, PlanDetailsValue } from './BuilderSheets';
import { ActionSheet, Chip, IconBtn, MenuAction, MetaPill } from './BuilderUi';
import { dayTitle, goalIndex, humanizeEnum, levelIndex, trainingDaysPerWeek, weekdayOf } from './builderUtils';

interface Props {
  /** A master plan (or any plan by id)… */
  planId?: number;
  /** …or a member's copy, by its assignment. */
  assignmentId?: number;
  onBack: () => void;
  /** The caller's own rights (the server's `canEdit` is applied as well). */
  canEdit?: boolean;
  canAssign?: boolean;
  /** Who assigns (trainer → own clients, admin → member search). */
  assigner?: Assigner;
  /** Open a member's copy (from the members list). */
  onOpenClientCopy?: (assignmentId: number) => void;
  /** Open another plan (after Duplicate). */
  onOpenPlan?: (planId: number) => void;
}

type Sub = { v: 'day'; day: BuilderDay } | { v: 'assign' };

const WIDE = 900;

/** Weekly plan builder: week tabs → 7 day cards; days open the DayEditor. */
export default function PlanBuilderScreen({ planId = 0, assignmentId = 0, onBack, canEdit = true, canAssign = true, assigner, onOpenClientCopy, onOpenPlan }: Props) {
  const byPlan = usePlanBuilder(assignmentId ? 0 : planId);
  const byAssignment = useClientPlanBuilder(assignmentId);
  const q = assignmentId ? byAssignment : byPlan;
  const plan = q.data;

  if (q.isLoading || (!plan && !q.isError)) {
    return (
      <Screen>
        <ScreenHeader eyebrow="Plan builder" title="Loading…" onBack={onBack} />
        <View style={{ padding: SP.xl }}><Skeleton rows={4} height={120} /></View>
      </Screen>
    );
  }
  if (q.isError || !plan) {
    return (
      <Screen>
        <ScreenHeader eyebrow="Plan builder" title="Plan" onBack={onBack} />
        <EmptyState icon="wifi-off" tone="error" title="Couldn't load this plan" subtitle={apiErrorText(q.error)} action={{ label: 'Retry', onPress: () => q.refetch() }} />
      </Screen>
    );
  }
  return (
    <Builder plan={plan} onBack={onBack} canEdit={canEdit && plan.canEdit} canAssign={canAssign && plan.isTemplate && !!assigner}
      assigner={assigner} onOpenClientCopy={onOpenClientCopy} onOpenPlan={onOpenPlan} />
  );
}

function Builder({ plan, onBack, canEdit, canAssign, assigner, onOpenClientCopy, onOpenPlan }: {
  plan: PlanBuilder; onBack: () => void; canEdit: boolean; canAssign: boolean; assigner?: Assigner;
  onOpenClientCopy?: (assignmentId: number) => void; onOpenPlan?: (planId: number) => void;
}) {
  const toast = useToast();
  const { width, hPad } = useLayout();
  const wide = width >= WIDE;
  const a = useBuilderActions(plan.planId);
  const updatePlan = useUpdatePlan(plan.planId);
  const duplicate = useDuplicatePlan();

  const [weekNo, setWeekNo] = useState(1);
  const [sub, setSub] = useState<Sub | null>(null);
  const [menuDay, setMenuDay] = useState<BuilderDay | null>(null);
  const [weekMenu, setWeekMenu] = useState(false);
  const [copyDayFrom, setCopyDayFrom] = useState<BuilderDay | null>(null);
  const [copyWeekOpen, setCopyWeekOpen] = useState(false);
  const [libraryFor, setLibraryFor] = useState<BuilderDay | null>(null);
  const [renameFor, setRenameFor] = useState<BuilderDay | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [busyDay, setBusyDay] = useState<string | null>(null);

  const weekCount = plan.weeks.length;
  const current = Math.min(weekNo, weekCount);
  const week = plan.weeks.find(w => w.weekNumber === current) ?? plan.weeks[0];
  const isCopy = !plan.isTemplate;

  const fail = (title: string) => (e: unknown) => showAlert(title, apiErrorText(e));

  /** The day with a dayId (and its own workout unless rest) — creates it on the server first if needed. */
  const ensureDay = useCallback(async (d: BuilderDay, isRestDay = d.isRestDay): Promise<BuilderDay> => {
    if (d.dayId && (isRestDay || (d.ownsWorkout && d.workoutId)) && isRestDay === d.isRestDay) return d;
    setBusyDay(`${d.weekNumber}-${d.dayNumber}`);
    try {
      return await a.upsert.mutateAsync({ week: d.weekNumber, day: d.dayNumber, body: { title: d.title, notes: d.notes, isRestDay } });
    } finally { setBusyDay(null); }
  }, [a.upsert]);

  const openDay = useCallback(async (d: BuilderDay) => {
    if (!canEdit) {
      if (d.workoutId && !d.isRestDay) setSub({ v: 'day', day: d });
      return;
    }
    if (d.isRestDay) { setMenuDay(d); return; }
    try { setSub({ v: 'day', day: await ensureDay(d, false) }); } catch (e) { fail('Could not open the day')(e); }
  }, [canEdit, ensureDay]);

  const setRest = async (d: BuilderDay, rest: boolean) => {
    try { await a.upsert.mutateAsync({ week: d.weekNumber, day: d.dayNumber, body: { title: d.title, notes: d.notes, isRestDay: rest } }); }
    catch (e) { fail('Could not update the day')(e); }
  };
  const rename = async (d: BuilderDay, title: string) => {
    setRenameFor(null);
    try { await a.upsert.mutateAsync({ week: d.weekNumber, day: d.dayNumber, body: { title: title || null, notes: d.notes, isRestDay: d.isRestDay } }); }
    catch (e) { fail('Could not rename the day')(e); }
  };
  const copyDayTo = async (targets: PlanDayRef[]) => {
    const d = copyDayFrom;
    setCopyDayFrom(null);
    if (!d) return;
    try {
      const src = await ensureDay(d);
      await a.copy.mutateAsync({ dayId: src.dayId as number, targets });
      toast.show({ type: 'success', message: `Copied to ${targets.length} day${targets.length === 1 ? '' : 's'}.` });
    } catch (e) { fail('Could not copy the day')(e); }
  };
  const addFromLibrary = async (workoutId: number, append: boolean) => {
    const d = libraryFor;
    setLibraryFor(null);
    if (!d) return;
    try {
      const src = await ensureDay(d, false);
      await a.fromLibrary.mutateAsync({ dayId: src.dayId as number, body: { workoutId, append } });
      toast.show({ type: 'success', message: 'Workout added to the day.' });
    } catch (e) { fail('Could not add the workout')(e); }
  };
  const clear = async (d: BuilderDay) => {
    if (!d.dayId) return;
    if (!(await confirm({ title: `Clear ${weekdayOf(d.dayNumber)}?`, message: 'All blocks and exercises of this day are removed.', confirmLabel: 'Clear', destructive: true }))) return;
    try { await a.clear.mutateAsync(d.dayId); } catch (e) { fail('Could not clear the day')(e); }
  };

  // ── Weeks ──
  const addWeek = async (copyFrom?: number) => {
    try {
      const b = await a.addWeek.mutateAsync(copyFrom);
      setWeekNo(b.weeks.length);
    } catch (e) { fail('Could not add a week')(e); }
  };
  const copyWeekTo = async (toWeeks: number[]) => {
    setCopyWeekOpen(false);
    try {
      await a.copyWeek.mutateAsync({ week: current, toWeeks });
      toast.show({ type: 'success', message: `Week ${current} copied to week${toWeeks.length === 1 ? '' : 's'} ${toWeeks.join(', ')}.` });
    } catch (e) { fail('Could not copy the week')(e); }
  };
  const deleteWeek = async () => {
    if (!(await confirm({ title: `Delete week ${current}?`, message: 'Its days are removed and later weeks move up.', confirmLabel: 'Delete week', destructive: true }))) return;
    try { await a.deleteWeek.mutateAsync(current); setWeekNo(w => Math.max(1, Math.min(w, weekCount - 1))); }
    catch (e) { fail('Could not delete the week')(e); }
  };

  // ── Plan ──
  const detailsInitial = useMemo<PlanDetailsValue>(() => ({
    name: plan.name, description: plan.description ?? '', goal: plan.goal, difficulty: plan.difficulty,
    weeks: String(plan.durationWeeks), daysPerWeek: plan.daysPerWeekHint ? String(plan.daysPerWeekHint) : '',
  }), [plan]);
  const saveDetails = async (v: PlanDetailsValue) => {
    try {
      await updatePlan.mutateAsync({
        name: v.name.trim(), description: v.description.trim(), goal: goalIndex(v.goal), difficulty: levelIndex(v.difficulty),
        daysPerWeekHint: v.daysPerWeek.trim() ? Number(v.daysPerWeek) : 0,
      });
      setDetailsOpen(false);
      toast.show({ type: 'success', message: 'Plan details saved.' });
    } catch (e) { fail('Could not save')(e); }
  };
  const doDuplicate = async () => {
    const ok = await confirm({
      title: isCopy ? 'Save as a new plan?' : 'Duplicate plan?',
      message: isCopy ? 'Makes a new master plan from this member\'s copy.' : `Creates "${plan.name} (copy)" with every week and day.`,
      confirmLabel: 'Duplicate',
    });
    if (!ok) return;
    try {
      const b = await duplicate.mutateAsync({ planId: plan.planId });
      toast.show({ type: 'success', message: `"${b.name}" created.` });
      onOpenPlan?.(b.planId);
    } catch (e) { fail('Could not duplicate')(e); }
  };

  const onMenu = useCallback((d: BuilderDay) => setMenuDay(d), []);

  // ── Sub-screens ──
  if (sub?.v === 'day' && sub.day.workoutId) {
    const d = sub.day;
    return (
      <DayEditor
        workoutId={d.workoutId as number}
        title={dayTitle(d)}
        eyebrow={`${isCopy ? `${plan.ownerClientName ?? 'Client'} · ` : ''}Week ${d.weekNumber} · ${weekdayOf(d.dayNumber)}`}
        day={{ planId: plan.planId, week: d.weekNumber, day: d.dayNumber, title: d.title, notes: d.notes }}
        readOnly={!canEdit}
        onBack={() => setSub(null)}
      />
    );
  }
  if (sub?.v === 'assign' && assigner) {
    return <AssignSheet plan={plan} assigner={assigner} onBack={() => setSub(null)} onOpenMembers={() => { setSub(null); setMembersOpen(true); }} />;
  }

  const dayActions: MenuAction[] = menuDay ? [
    { icon: 'edit-3', label: menuDay.isRestDay ? 'Unmark rest & edit' : 'Edit exercises', onPress: () => (menuDay.isRestDay ? ensureDay(menuDay, false).then(d => setSub({ v: 'day', day: d })).catch(fail('Could not open the day')) : openDay(menuDay)) },
    { icon: 'type', label: 'Rename', onPress: () => setRenameFor(menuDay) },
    { icon: 'moon', label: menuDay.isRestDay ? 'Unmark rest day' : 'Mark as rest day', onPress: () => setRest(menuDay, !menuDay.isRestDay) },
    { icon: 'copy', label: 'Copy to…', onPress: () => setCopyDayFrom(menuDay) },
    { icon: 'book', label: 'Add from library', onPress: () => setLibraryFor(menuDay) },
    { icon: 'trash-2', label: 'Clear day', danger: true, disabled: !menuDay.dayId || menuDay.exerciseCount === 0, onPress: () => clear(menuDay) },
  ] : [];
  const weekActions: MenuAction[] = [
    { icon: 'copy', label: 'Copy to weeks…', onPress: () => setCopyWeekOpen(true) },
    { icon: 'plus-square', label: 'Duplicate as new week', disabled: weekCount >= 52, onPress: () => addWeek(current) },
    { icon: 'trash-2', label: 'Delete week', danger: true, disabled: weekCount <= 1, onPress: deleteWeek },
  ];

  const perWeek = trainingDaysPerWeek(plan);
  const ca = plan.clientAssignment;
  const busy = (d: BuilderDay) => busyDay === `${d.weekNumber}-${d.dayNumber}`;

  return (
    <Screen>
      <ScreenHeader eyebrow={isCopy ? `Client copy · ${plan.ownerClientName ?? 'Member'}` : 'Plan builder'} title={plan.name} onBack={onBack} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: hPad, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: SP.sm }}>
          <StatusPill label={humanizeEnum(plan.goal)} tone={goalTone(plan.goal)} />
          <StatusPill label={plan.difficulty} tone={difficultyTone(plan.difficulty)} />
          <MetaPill icon="calendar" label={`${weekCount} week${weekCount === 1 ? '' : 's'}`} />
          {perWeek > 0 && <MetaPill icon="repeat" label={`${perWeek} days/week`} />}
          {!plan.isActive && <StatusPill label="Archived" tone="neutral" />}
        </View>
        {!!plan.description && <Text style={{ color: T.textSub, fontSize: 13, marginBottom: SP.sm }} numberOfLines={3}>{plan.description}</Text>}
        {ca && (
          <View style={{ backgroundColor: withAlpha(T.sky, 0.08), borderColor: withAlpha(T.sky, 0.3), borderWidth: 1, borderRadius: R.md, padding: SP.md, marginBottom: SP.sm }}>
            <Text style={{ color: T.text, fontSize: 13, fontWeight: '700' }}>
              {ca.clientName ?? plan.ownerClientName ?? 'Member'} · {ca.status === 'InProgress' ? 'In progress' : ca.status}
            </Text>
            <Text style={{ color: T.textSub, fontSize: 12, marginTop: 2 }}>
              {formatDate(ca.startDate)} → {formatDate(ca.endDate)}{ca.currentWeek ? ` · now W${ca.currentWeek} ${weekdayOf(ca.currentDay ?? 1)}` : ''}
              {ca.adherence?.percent != null ? ` · ${Math.round(ca.adherence.percent)}% adherence` : ''}
            </Text>
            <Text style={{ color: T.textFaint, fontSize: 11, marginTop: 4 }}>Changes here only affect this member.</Text>
          </View>
        )}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm, marginBottom: SP.lg }}>
          {canEdit && <SmallButton icon="edit-2" label="Edit details" tone={T.textSub} size="sm" onPress={() => setDetailsOpen(true)} />}
          {canAssign && <SmallButton icon="user-plus" label="Assign" size="sm" onPress={() => setSub({ v: 'assign' })} />}
          {!isCopy && <SmallButton icon="users" label="Members" tone={T.sky} size="sm" onPress={() => setMembersOpen(true)} />}
          {isCopy && ca && <SmallButton icon="calendar" label="Schedule" tone={T.sky} size="sm" onPress={() => setScheduleOpen(true)} />}
          {canEdit && <SmallButton icon="copy" label={isCopy ? 'Save as plan' : 'Duplicate'} tone={T.textSub} size="sm" busy={duplicate.isPending} onPress={doDuplicate} />}
        </View>

        {/* Week tabs */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm, marginBottom: SP.md }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ gap: 6, paddingRight: SP.sm }}>
            {plan.weeks.map(w => (
              <Chip key={w.weekNumber} label={`W${w.weekNumber}`} active={w.weekNumber === current} a11y={`Week ${w.weekNumber}`} onPress={() => setWeekNo(w.weekNumber)} />
            ))}
            {canEdit && weekCount < 52 && <Chip label="Week" icon="plus" a11y="Add a week" onPress={() => !a.addWeek.isPending && addWeek()} />}
          </ScrollView>
          {canEdit && <IconBtn icon="more-vertical" label={`Week ${current} actions`} onPress={() => setWeekMenu(true)} size={36} />}
        </View>

        {/* Days */}
        {week && (wide ? (
          <View style={{ flexDirection: 'row', gap: SP.sm, alignItems: 'stretch' }}>
            {week.days.map(d => <DayCard key={d.dayNumber} day={d} compact canEdit={canEdit} busy={busy(d)} onOpen={openDay} onMenu={onMenu} />)}
          </View>
        ) : (
          <View style={{ gap: SP.sm }}>
            {week.days.map(d => <DayCard key={d.dayNumber} day={d} canEdit={canEdit} busy={busy(d)} onOpen={openDay} onMenu={onMenu} />)}
          </View>
        ))}
      </ScrollView>

      <ActionSheet visible={menuDay !== null} title={menuDay ? `${weekdayOf(menuDay.dayNumber)} · ${dayTitle(menuDay)}` : ''} actions={dayActions} onClose={() => setMenuDay(null)} />
      <ActionSheet visible={weekMenu} title={`Week ${current}`} actions={weekActions} onClose={() => setWeekMenu(false)} />
      <DayCopySheet visible={copyDayFrom !== null} weeks={plan.weeks} source={copyDayFrom ? { week: copyDayFrom.weekNumber, day: copyDayFrom.dayNumber } : null}
        onClose={() => setCopyDayFrom(null)} onCopy={copyDayTo} />
      <WeekCopySheet visible={copyWeekOpen} totalWeeks={weekCount} source={current} onClose={() => setCopyWeekOpen(false)} onCopy={copyWeekTo} />
      <LibraryWorkoutSheet visible={libraryFor !== null} dayHasContent={(libraryFor?.exerciseCount ?? 0) > 0} onClose={() => setLibraryFor(null)} onPick={(w, append) => addFromLibrary(w.id, append)} />
      <RenameSheet visible={renameFor !== null} initial={renameFor?.title ?? ''} title={renameFor ? `Rename ${weekdayOf(renameFor.dayNumber)}` : ''}
        onClose={() => setRenameFor(null)} onSave={v => renameFor && rename(renameFor, v)} />
      <PlanDetailsSheet visible={detailsOpen} title="Plan details" initial={detailsInitial} showWeeks={false} saving={updatePlan.isPending} submitLabel="Save"
        onClose={() => setDetailsOpen(false)} onSubmit={saveDetails} />
      {!isCopy && (
        <PlanMembersSheet visible={membersOpen} planId={plan.planId} planName={plan.name} onClose={() => setMembersOpen(false)}
          onOpen={m => { setMembersOpen(false); onOpenClientCopy?.(m.assignmentId); }} />
      )}
      {ca && <ClientScheduleSheet visible={scheduleOpen} assignmentId={ca.assignmentId} onClose={() => setScheduleOpen(false)} />}
    </Screen>
  );
}
