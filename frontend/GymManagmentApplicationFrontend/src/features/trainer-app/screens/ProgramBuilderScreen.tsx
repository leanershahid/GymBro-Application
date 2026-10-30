import React, { useState } from 'react';
import { currentTenantId } from '../../../api/session';
import {
  View, Text, ScrollView, Pressable,
  Platform, Alert, KeyboardAvoidingView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useExerciseList } from '../../member-app/api/memberAppQueries';
import { useWorkouts, useCreateWorkout, usePlans, useCreatePlan, useDeleteWorkout } from '../../workouts/api/workoutQueries';
import {
  Workout, WorkoutPlan, WorkoutPayload, WorkoutPlanPayload, WorkoutGoal, WorkoutDifficulty,
} from '../../workouts/types/workout.types';
import { T, R, SP, withAlpha } from '../../../theme';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import SegmentedTabs from '../../common/components/SegmentedTabs';
import SearchBar from '../../common/components/SearchBar';
import PrimaryButton from '../../common/components/PrimaryButton';
import Skeleton from '../../common/components/Skeleton';
import StatusPill from '../../common/components/StatusPill';
import PaginationFooter from '../../common/components/PaginationFooter';
import BottomSheet from '../../common/components/BottomSheet';
import { useToast } from '../../common/components/Toast';
import EmptyState from '../../dashboard/components/EmptyState';
import { Field } from '../../trainers/components/FormFields';
import { humanize } from '../../exercises/components/ChipSelect';
import { difficultyTone, goalTone } from '../../member-app/components/pillTones';
import { apiErrorText } from '../../../api/apiError';
import { useCloneWorkout } from '../api/programQueries';
import WorkoutEditor from '../components/WorkoutEditor';
import PlanScheduleEditor from '../components/PlanScheduleEditor';
import AssignPage from '../components/AssignPage';
import DetailsPage from '../components/DetailsPage';
import IconButton from '../components/IconButton';

type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

const GOAL_COLOR: Record<string, string> = {
  general: T.textSub, weightloss: T.sky, musclegain: T.brand, endurance: T.brandGold,
};
const CAT_ICON: Record<string, FeatherIconName> = {
  strength: 'zap', cardio: 'activity', flexibility: 'wind', balance: 'target',
};
const DIFF_COLOR: Record<string, string> = {
  beginner: T.ok, intermediate: T.brandGold, advanced: T.err,
};

const EX_FILTERS = ['All', 'Strength', 'Cardio', 'Flexibility', 'Balance'];
const GOALS: WorkoutGoal[] = ['General', 'WeightLoss', 'MuscleGain', 'Endurance'];
const DIFFS: WorkoutDifficulty[] = ['Beginner', 'Intermediate', 'Advanced'];

type Tab = 'workouts' | 'plans' | 'exercises';

/** Sub-screens opened from the builder lists. */
type Sub =
  | { v: 'workout'; id: number; name: string }
  | { v: 'plan'; id: number; name: string; weeks: number }
  | { v: 'assign'; kind: 'workout' | 'plan'; id: number; name: string }
  | { v: 'details-workout'; item: Workout }
  | { v: 'details-plan'; item: WorkoutPlan };

type Menu = { kind: 'workout'; item: Workout } | { kind: 'plan'; item: WorkoutPlan };

interface Props { trainerId: number; onBack?: () => void; }

export default function ProgramBuilderScreen({ trainerId, onBack }: Props) {
  const toast = useToast();
  const [tab, setTab]           = useState<Tab>('workouts');
  const [sub, setSub]           = useState<Sub | null>(null);
  const [menu, setMenu]         = useState<Menu | null>(null);
  const [exPage, setExPage]     = useState(1);
  const [exFilter, setExFilter] = useState('All');
  const [exSearch, setExSearch] = useState('');
  const [wPage, setWPage]       = useState(1);
  const [pPage, setPPage]       = useState(1);

  // Create workout form
  const [showWForm, setShowWForm] = useState(false);
  const [wName, setWName]         = useState('');
  const [wGoal, setWGoal]         = useState<WorkoutGoal>('General');
  const [wDiff, setWDiff]         = useState<WorkoutDifficulty>('Intermediate');
  const [wDuration, setWDuration] = useState('');

  // Create plan form
  const [showPForm, setShowPForm] = useState(false);
  const [pName, setPName]         = useState('');
  const [pWeeks, setPWeeks]       = useState('');
  const [pGoal, setPGoal]         = useState<WorkoutGoal>('General');

  const tagParam = exFilter !== 'All' ? exFilter.toLowerCase() : undefined;
  const ex = useExerciseList(exPage, tagParam);
  const wq = useWorkouts(wPage, 20);
  const pq = usePlans(pPage, 20);
  const { mutate: createWorkout, isPending: creating } = useCreateWorkout();
  const { mutate: createPlan,    isPending: creatingPlan } = useCreatePlan();
  const { mutate: deleteWorkout } = useDeleteWorkout();
  const { mutate: cloneWorkout } = useCloneWorkout();

  const exercises = ex.data?.items ?? [];
  const workouts  = wq.data?.items ?? [];
  const plans     = pq.data?.items ?? [];

  const filteredEx = exSearch.trim() ? exercises.filter(e => e.name.toLowerCase().includes(exSearch.toLowerCase())) : exercises;

  // ── Sub-screens ──
  if (sub?.v === 'workout') return <WorkoutEditor workoutId={sub.id} workoutName={sub.name} onBack={() => setSub(null)} />;
  if (sub?.v === 'plan') return <PlanScheduleEditor planId={sub.id} planName={sub.name} durationWeeks={sub.weeks} onBack={() => setSub(null)} />;
  if (sub?.v === 'assign') return <AssignPage kind={sub.kind} id={sub.id} name={sub.name} trainerId={trainerId} onBack={() => setSub(null)} />;
  if (sub?.v === 'details-workout') return <DetailsPage kind="workout" item={sub.item} onBack={() => setSub(null)} />;
  if (sub?.v === 'details-plan') return <DetailsPage kind="plan" item={sub.item} onBack={() => setSub(null)} />;

  const handleCreateWorkout = () => {
    if (!wName.trim()) return;
    const payload: WorkoutPayload = { tenantId: currentTenantId(), name: wName.trim(), goal: wGoal, difficulty: wDiff, durationMin: wDuration ? Number(wDuration) : undefined, isPublic: false };
    createWorkout(payload, {
      onSuccess: res => {
        if (!res.success || !res.data) { Alert.alert('Could not create workout', res.message || 'Please try again.'); return; }
        setShowWForm(false); setWName(''); setWDuration('');
        toast.show({ type: 'success', message: 'Workout created — now add its exercises.' });
        setSub({ v: 'workout', id: res.data.id, name: res.data.name });
      },
      onError: e => Alert.alert('Could not create workout', apiErrorText(e)),
    });
  };

  const handleCreatePlan = () => {
    if (!pName.trim() || !pWeeks) return;
    const payload: WorkoutPlanPayload = { tenantId: currentTenantId(), name: pName.trim(), durationWeeks: Number(pWeeks), goal: pGoal };
    createPlan(payload, {
      onSuccess: res => {
        if (!res.success || !res.data) { Alert.alert('Could not create plan', res.message || 'Please try again.'); return; }
        setShowPForm(false); setPName(''); setPWeeks('');
        toast.show({ type: 'success', message: 'Plan created — now fill in its schedule.' });
        setSub({ v: 'plan', id: res.data.id, name: res.data.name, weeks: res.data.durationWeeks });
      },
      onError: e => Alert.alert('Could not create plan', apiErrorText(e)),
    });
  };

  const confirmDeleteWorkout = (w: Workout) => {
    Alert.alert('Delete workout?', `"${w.name}" will be deleted. Clients it was assigned to will no longer see it.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => deleteWorkout(w.id, {
          onSuccess: (res: { success?: boolean; message?: string }) => {
            if (res && res.success === false) { Alert.alert('Could not delete', res.message || 'The workout was not deleted.'); return; }
            toast.show({ type: 'success', message: res?.message || 'Workout deleted.' });
          },
          onError: e => Alert.alert('Could not delete', apiErrorText(e)),
        }),
      },
    ]);
  };

  const doClone = (w: Workout) => cloneWorkout(w.id, {
    onSuccess: res => {
      if (!res.success) { Alert.alert('Could not clone', res.message || 'The workout was not cloned.'); return; }
      toast.show({ type: 'success', message: res.message || 'Workout cloned.' });
    },
    onError: e => Alert.alert('Could not clone', apiErrorText(e)),
  });

  /** Close the action sheet first so a follow-up Alert isn't swallowed by the closing modal. */
  const runMenu = (fn: () => void) => { setMenu(null); setTimeout(fn, 250); };

  const menuActions: { icon: FeatherIconName; label: string; danger?: boolean; onPress: () => void }[] =
    menu?.kind === 'workout' ? [
      { icon: 'list',       label: 'Edit exercises',     onPress: () => runMenu(() => setSub({ v: 'workout', id: menu.item.id, name: menu.item.name })) },
      { icon: 'edit-2',     label: 'Edit details',       onPress: () => runMenu(() => setSub({ v: 'details-workout', item: menu.item })) },
      { icon: 'user-plus',  label: 'Assign to clients',  onPress: () => runMenu(() => setSub({ v: 'assign', kind: 'workout', id: menu.item.id, name: menu.item.name })) },
      { icon: 'copy',       label: 'Clone',              onPress: () => runMenu(() => doClone(menu.item)) },
      { icon: 'trash-2',    label: 'Delete',             danger: true, onPress: () => runMenu(() => confirmDeleteWorkout(menu.item)) },
    ] : menu?.kind === 'plan' ? [
      { icon: 'calendar',   label: 'Edit schedule',      onPress: () => runMenu(() => setSub({ v: 'plan', id: menu.item.id, name: menu.item.name, weeks: menu.item.durationWeeks })) },
      { icon: 'edit-2',     label: 'Edit details',       onPress: () => runMenu(() => setSub({ v: 'details-plan', item: menu.item })) },
      { icon: 'user-plus',  label: 'Assign to clients',  onPress: () => runMenu(() => setSub({ v: 'assign', kind: 'plan', id: menu.item.id, name: menu.item.name })) },
    ] : [];

  return (
    <Screen>

      {/* Header */}
      <ScreenHeader eyebrow="Trainer" title="Program Builder" onBack={onBack} />
      <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
        <SegmentedTabs<Tab>
          tabs={[
            { key: 'workouts',  label: 'Workouts' },
            { key: 'plans',     label: 'Plans' },
            { key: 'exercises', label: 'Exercises' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

      {/* ── Workouts ── */}
      {tab === 'workouts' && (
        <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
          <PrimaryButton
            label="New Workout"
            icon={showWForm ? 'chevron-up' : 'plus'}
            onPress={() => setShowWForm(v => !v)}
            accessibilityHint={showWForm ? 'Hides the new workout form' : 'Shows the new workout form'}
            style={{ alignSelf: 'flex-start', marginBottom: 16 }}
          />

          {showWForm && (
            <View style={{ backgroundColor: T.bgInput, borderRadius: R.xl, padding: 16, borderWidth: 1, borderColor: T.bgInputActive, marginBottom: 16 }}>
              <Field label="Workout name" value={wName} onChangeText={setWName} placeholder="Workout name…" />
              <Text style={{ color: T.textSub, fontSize: 13, marginBottom: 7 }}>Goal</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                {GOALS.map(g => <Chip key={g} label={humanize(g)} a11y={`Goal: ${g}`} active={wGoal === g} onPress={() => setWGoal(g)} />)}
              </View>
              <Text style={{ color: T.textSub, fontSize: 13, marginBottom: 7 }}>Difficulty</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                {DIFFS.map(d => <Pressable key={d} onPress={() => setWDiff(d)}
                  hitSlop={4}
                  accessibilityRole="button"
                  accessibilityLabel={`Difficulty: ${d}`}
                  accessibilityState={{ selected: wDiff === d }}
                  style={{ flex: 1, minHeight: 36, justifyContent: 'center', paddingVertical: 8, borderRadius: 12, alignItems: 'center', backgroundColor: wDiff === d ? withAlpha(T.brand, 0.12) : T.bgInputActive, borderWidth: 1, borderColor: wDiff === d ? withAlpha(T.brand, 0.35) : T.line }}>
                  <Text numberOfLines={1} style={{ color: wDiff === d ? T.brand : T.textSub, fontSize: 11, fontWeight: '700' }}>{d}</Text>
                </Pressable>)}
              </View>
              <Field label="Duration (min)" value={wDuration} onChangeText={setWDuration} placeholder="Duration (min)…" keyboardType="numeric" />
              <PrimaryButton label="Create & add exercises" onPress={handleCreateWorkout} loading={creating} disabled={!wName.trim()} />
            </View>
          )}

          {wq.isLoading && <Skeleton rows={3} height={90} />}
          {wq.isError && (
            <EmptyState icon="wifi-off" tone="error" title="Couldn't load workouts" subtitle={apiErrorText(wq.error)} action={{ label: 'Retry', onPress: () => wq.refetch() }} />
          )}
          {!wq.isLoading && !wq.isError && workouts.length === 0 && (
            <EmptyState icon="activity" title="No workouts yet" subtitle="Create one, then add sections and exercises." />
          )}
          {!wq.isLoading && !wq.isError && workouts.map(w => (
            <ItemCard
              key={w.id}
              title={w.name}
              a11yHint="Opens the workout editor"
              onPress={() => setSub({ v: 'workout', id: w.id, name: w.name })}
              onMore={() => setMenu({ kind: 'workout', item: w })}
            >
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {w.goal && <StatusPill label={humanize(w.goal)} tone={goalTone(w.goal)} />}
                {w.difficulty && <StatusPill label={w.difficulty} tone={difficultyTone(w.difficulty)} />}
                {!!w.durationMin && <MetaPill icon="clock" label={`${w.durationMin}m`} />}
              </View>
            </ItemCard>
          ))}
          {!wq.isLoading && !wq.isError && <PaginationFooter page={wPage} totalPages={wq.data?.totalPages ?? 1} onChange={setWPage} />}
        </ScrollView>
      )}

      {/* ── Plans ── */}
      {tab === 'plans' && (
        <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
          <PrimaryButton
            label="New Plan"
            icon={showPForm ? 'chevron-up' : 'plus'}
            onPress={() => setShowPForm(v => !v)}
            accessibilityHint={showPForm ? 'Hides the new plan form' : 'Shows the new plan form'}
            style={{ alignSelf: 'flex-start', marginBottom: 16 }}
          />

          {showPForm && (
            <View style={{ backgroundColor: T.bgInput, borderRadius: R.xl, padding: 16, borderWidth: 1, borderColor: T.bgInputActive, marginBottom: 16 }}>
              <Field label="Plan name" value={pName} onChangeText={setPName} placeholder="Plan name…" />
              <Field label="Duration (weeks)" value={pWeeks} onChangeText={setPWeeks} placeholder="Duration (weeks)…" keyboardType="numeric" />
              <Text style={{ color: T.textSub, fontSize: 13, marginBottom: 7 }}>Goal</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                {GOALS.map(g => <Chip key={g} label={humanize(g)} a11y={`Goal: ${g}`} active={pGoal === g} onPress={() => setPGoal(g)} />)}
              </View>
              <PrimaryButton label="Create & build schedule" onPress={handleCreatePlan} loading={creatingPlan} disabled={!pName.trim() || !pWeeks} />
            </View>
          )}

          {pq.isLoading && <Skeleton rows={3} height={90} />}
          {pq.isError && (
            <EmptyState icon="wifi-off" tone="error" title="Couldn't load plans" subtitle={apiErrorText(pq.error)} action={{ label: 'Retry', onPress: () => pq.refetch() }} />
          )}
          {!pq.isLoading && !pq.isError && plans.length === 0 && (
            <EmptyState icon="calendar" title="No plans yet" subtitle="Create a plan, then schedule a workout for each day." />
          )}
          {!pq.isLoading && !pq.isError && plans.map(plan => {
            const gc = GOAL_COLOR[plan.goal?.toLowerCase() ?? 'general'] ?? T.textSub;
            return (
              <ItemCard
                key={plan.id}
                title={plan.name}
                accent={gc}
                a11yHint="Opens the plan schedule"
                onPress={() => setSub({ v: 'plan', id: plan.id, name: plan.name, weeks: plan.durationWeeks })}
                onMore={() => setMenu({ kind: 'plan', item: plan })}
              >
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                  <MetaPill icon="calendar" label={`${plan.durationWeeks} wk${plan.durationWeeks === 1 ? '' : 's'}`} />
                  {plan.goal && <StatusPill label={humanize(plan.goal)} tone={goalTone(plan.goal)} />}
                  {plan.difficulty && <StatusPill label={plan.difficulty} tone={difficultyTone(plan.difficulty)} />}
                </View>
              </ItemCard>
            );
          })}
          {!pq.isLoading && !pq.isError && <PaginationFooter page={pPage} totalPages={pq.data?.totalPages ?? 1} onChange={setPPage} />}
        </ScrollView>
      )}

      {/* ── Exercise Library (browse; add exercises from inside the workout editor) ── */}
      {tab === 'exercises' && (
        <>
          <View style={{ paddingHorizontal: 20, paddingBottom: 10 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 10 }}>
              {EX_FILTERS.map(f => (
                <Chip key={f} label={f} a11y={`Filter: ${f}`} active={f === exFilter} onPress={() => { setExFilter(f); setExPage(1); }} />
              ))}
            </ScrollView>
            <SearchBar value={exSearch} onChangeText={setExSearch} placeholder="Search…" label="Search exercises" />
          </View>
          <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
            {ex.isLoading && <Skeleton rows={3} height={90} />}
            {ex.isError && (
              <EmptyState icon="wifi-off" tone="error" title="Couldn't load exercises" subtitle={apiErrorText(ex.error)} action={{ label: 'Retry', onPress: () => ex.refetch() }} />
            )}
            {!ex.isLoading && !ex.isError && filteredEx.length === 0 && (
              <EmptyState icon="search" title={exSearch ? 'No matching exercises' : 'No exercises in this category'} />
            )}
            {!ex.isLoading && !ex.isError && filteredEx.map(e => {
              const diff  = e.difficulty?.toLowerCase() ?? 'beginner';
              const cat   = e.category?.toLowerCase()   ?? 'strength';
              const color = DIFF_COLOR[diff] ?? T.textSub;
              const icon  = CAT_ICON[cat]   ?? 'zap';
              return (
                <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: T.bgInput, borderRadius: R.lg, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: T.bgInputActive }}>
                  <View style={{ width: 52, height: 52, borderRadius: 12, backgroundColor: T.bgInputActive, borderWidth: 1, borderColor: T.line, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                    <Feather name={icon} size={22} color={color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: T.text, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>{e.name}</Text>
                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                      {e.category && <StatusPill label={e.category} tone="neutral" />}
                      {e.difficulty && <StatusPill label={e.difficulty} tone={difficultyTone(e.difficulty)} />}
                    </View>
                  </View>
                </View>
              );
            })}
            {!ex.isLoading && !ex.isError && !exSearch && <PaginationFooter page={exPage} totalPages={ex.data?.totalPages ?? 1} onChange={setExPage} />}
          </ScrollView>
        </>
      )}
      </KeyboardAvoidingView>

      {/* ── Item actions ── */}
      <BottomSheet visible={menu !== null} onClose={() => setMenu(null)} title={menu?.item.name ?? ''}>
        <View style={{ paddingHorizontal: SP.xl, paddingTop: SP.md }}>
          {menuActions.map(a => (
            <Pressable
              key={a.label}
              onPress={a.onPress}
              accessibilityRole="button"
              accessibilityLabel={a.label}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: SP.md, minHeight: 52, paddingHorizontal: SP.md,
                borderRadius: R.md, backgroundColor: pressed ? T.bgInputActive : 'transparent',
              })}
            >
              <Feather name={a.icon} size={18} color={a.danger ? T.err : T.textSub} />
              <Text style={{ color: a.danger ? T.err : T.text, fontSize: 15, fontWeight: '600' }}>{a.label}</Text>
            </Pressable>
          ))}
        </View>
      </BottomSheet>
    </Screen>
  );
}

// ─── Small pieces ───────────────────────────────────────────────────
function Chip({ label, a11y, active, onPress }: { label: string; a11y: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ selected: active }}
      style={{ minHeight: 36, justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: active ? T.brand : T.bgInputActive, borderWidth: 1, borderColor: active ? T.brand : T.line }}
    >
      <Text style={{ color: active ? T.onBrand : T.textSub, fontSize: 11, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

function MetaPill({ icon, label }: { icon: FeatherIconName; label: string }) {
  return (
    <View style={{ backgroundColor: T.bgInputActive, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: T.line, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Feather name={icon} size={10} color={T.textFaint} />
      <Text style={{ color: T.textSub, fontSize: 11 }}>{label}</Text>
    </View>
  );
}

function ItemCard({ title, accent, a11yHint, onPress, onMore, children }: {
  title: string; accent?: string; a11yHint: string; onPress: () => void; onMore: () => void; children: React.ReactNode;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: T.bgInput, borderRadius: R.lg, marginBottom: 10, borderWidth: 1, borderColor: T.bgInputActive }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityHint={a11yHint}
        style={({ pressed }) => ({ flex: 1, padding: 14, borderRadius: R.lg, opacity: pressed ? 0.75 : 1 })}
      >
        {accent && <View style={{ height: 3, backgroundColor: accent, borderRadius: 2, marginBottom: 10, width: 36 }} />}
        <Text numberOfLines={2} style={{ color: T.text, fontSize: 15, fontWeight: '700', marginBottom: 8 }}>{title}</Text>
        {children}
      </Pressable>
      <View style={{ paddingRight: 12 }}>
        <IconButton icon="more-horizontal" label={`Actions for ${title}`} onPress={onMore} size={36} />
      </View>
    </View>
  );
}
