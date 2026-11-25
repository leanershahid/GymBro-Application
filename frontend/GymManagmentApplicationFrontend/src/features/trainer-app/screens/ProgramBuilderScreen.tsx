import React, { useReducer, useState } from 'react';
import { currentTenantId } from '../../../api/session';
import {
  View, Text, ScrollView, Pressable,
  Platform, KeyboardAvoidingView,
} from 'react-native';
import { showAlert } from '../../common/components/dialogs';
import { Feather } from '@expo/vector-icons';
import { useExerciseLibrary } from '../../exercises/api/exerciseQueries';
import { useWorkouts, useCreateWorkout, useDeleteWorkout } from '../../workouts/api/workoutQueries';
import {
  Workout, WorkoutPayload, WorkoutGoal, WorkoutDifficulty,
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
import EmptyState from '../../common/components/EmptyState';
import { Field } from '../../common/components/FormFields';
import { humanize } from '../../common/components/ChipSelect';
import { difficultyTone, goalTone } from '../../common/constants/statusColors';
import { apiErrorText } from '../../../api/apiError';
import { useCloneWorkout } from '../api/programQueries';
import { DayEditor, PlansList, workoutInUseFrom, workoutInUseText } from '../../training/builder';
import AssignPage from '../components/AssignPage';
import DetailsPage from '../components/DetailsPage';
import IconButton from '../components/IconButton';
import { usePageTabs } from '../../access/context/AccessContext';

type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

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
  | { v: 'assign'; id: number; name: string }
  | { v: 'details-workout'; item: Workout };

type Menu = { kind: 'workout'; item: Workout };

interface Props {
  trainerId: number;
  onBack?: () => void;
  /** Opens a plan in the weekly plan builder (its own route). */
  onOpenPlan: (planId: number) => void;
}

interface WorkoutForm { open: boolean; name: string; goal: WorkoutGoal; diff: WorkoutDifficulty; duration: string }
const WORKOUT_FORM: WorkoutForm = { open: false, name: '', goal: 'General', diff: 'Intermediate', duration: '' };
/** Reducer that merges a partial update into a form object. */
function patch<F>(state: F, update: Partial<F>): F { return { ...state, ...update }; }

export default function ProgramBuilderScreen({ trainerId, onBack, onOpenPlan }: Props) {
  const toast = useToast();
  // Tabs come from the access list (trainer.programs.*).
  const { items: tabs, tab: pageTab, setTab } = usePageTabs('trainer.programs');
  const tab = pageTab as Tab | null;
  const [sub, setSub]           = useState<Sub | null>(null);
  const [menu, setMenu]         = useState<Menu | null>(null);
  const [exPage, setExPage]     = useState(1);
  const [exFilter, setExFilter] = useState('All');
  const [exSearch, setExSearch] = useState('');
  const [wPage, setWPage]       = useState(1);

  // Create-workout and create-plan forms: one state object each (ARCH-116).
  const [wForm, patchW] = useReducer(patch<WorkoutForm>, WORKOUT_FORM);
  const { open: showWForm, name: wName, goal: wGoal, diff: wDiff, duration: wDuration } = wForm;

  const tagParam = exFilter !== 'All' ? exFilter.toLowerCase() : undefined;
  const ex = useExerciseLibrary(exPage, tagParam);
  const wq = useWorkouts(wPage, 20);
  const { mutate: createWorkout, isPending: creating } = useCreateWorkout();
  const { mutate: deleteWorkout } = useDeleteWorkout();
  const { mutate: cloneWorkout } = useCloneWorkout();

  const exercises = ex.data?.items ?? [];
  const workouts  = wq.data?.items ?? [];

  const filteredEx = exSearch.trim() ? exercises.filter(e => e.name.toLowerCase().includes(exSearch.toLowerCase())) : exercises;

  // ── Sub-screens ──
  if (sub?.v === 'workout') return <DayEditor workoutId={sub.id} title={sub.name} onBack={() => setSub(null)} />;
  if (sub?.v === 'assign') return <AssignPage id={sub.id} name={sub.name} trainerId={trainerId} onBack={() => setSub(null)} />;
  if (sub?.v === 'details-workout') return <DetailsPage kind="workout" item={sub.item} onBack={() => setSub(null)} />;

  const handleCreateWorkout = () => {
    if (!wName.trim()) return;
    const payload: WorkoutPayload = { tenantId: currentTenantId(), name: wName.trim(), goal: wGoal, difficulty: wDiff, durationMin: wDuration ? Number(wDuration) : undefined, isPublic: false };
    createWorkout(payload, {
      onSuccess: res => {
        if (!res.success || !res.data) { showAlert('Could not create workout', res.message || 'Please try again.'); return; }
        patchW({ open: false, name: '', duration: '' });
        toast.show({ type: 'success', message: 'Workout created — now add its exercises.' });
        setSub({ v: 'workout', id: res.data.id, name: res.data.name });
      },
      onError: e => showAlert('Could not create workout', apiErrorText(e)),
    });
  };

  const confirmDeleteWorkout = (w: Workout) => {
    showAlert('Delete workout?', `"${w.name}" will be deleted. Clients it was assigned to will no longer see it.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => deleteWorkout(w.id, {
          onSuccess: (res: { success?: boolean; message?: string }) => {
            const inUse = workoutInUseFrom(res);
            if (inUse) { showAlert('Workout in use', workoutInUseText(inUse)); return; }
            if (res && res.success === false) { showAlert('Could not delete', res.message || 'The workout was not deleted.'); return; }
            toast.show({ type: 'success', message: res?.message || 'Workout deleted.' });
          },
          onError: e => {
            const inUse = workoutInUseFrom(e);
            showAlert(inUse ? 'Workout in use' : 'Could not delete', inUse ? workoutInUseText(inUse) : apiErrorText(e));
          },
        }),
      },
    ]);
  };

  const doClone = (w: Workout) => cloneWorkout(w.id, {
    onSuccess: res => {
      if (!res.success) { showAlert('Could not clone', res.message || 'The workout was not cloned.'); return; }
      toast.show({ type: 'success', message: res.message || 'Workout cloned.' });
    },
    onError: e => showAlert('Could not clone', apiErrorText(e)),
  });

  /** Close the action sheet first so a follow-up Alert isn't swallowed by the closing modal. */
  const runMenu = (fn: () => void) => { setMenu(null); setTimeout(fn, 250); };

  const menuActions: { icon: FeatherIconName; label: string; danger?: boolean; onPress: () => void }[] =
    menu?.kind === 'workout' ? [
      { icon: 'list',       label: 'Edit exercises',     onPress: () => runMenu(() => setSub({ v: 'workout', id: menu.item.id, name: menu.item.name })) },
      { icon: 'edit-2',     label: 'Edit details',       onPress: () => runMenu(() => setSub({ v: 'details-workout', item: menu.item })) },
      { icon: 'user-plus',  label: 'Assign to clients',  onPress: () => runMenu(() => setSub({ v: 'assign', id: menu.item.id, name: menu.item.name })) },
      { icon: 'copy',       label: 'Clone',              onPress: () => runMenu(() => doClone(menu.item)) },
      { icon: 'trash-2',    label: 'Delete',             danger: true, onPress: () => runMenu(() => confirmDeleteWorkout(menu.item)) },
    ] : [];

  return (
    <Screen>

      {/* Header */}
      <ScreenHeader eyebrow="Trainer" title="Program Builder" onBack={onBack} />
      <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
        {tabs.length > 1 && <SegmentedTabs tabs={tabs} value={tab ?? ''} onChange={setTab} />}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

      {/* ── Workouts ── */}
      {tab === 'workouts' && (
        <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
          <PrimaryButton
            label="New Workout"
            icon={showWForm ? 'chevron-up' : 'plus'}
            onPress={() => patchW({ open: !showWForm })}
            accessibilityHint={showWForm ? 'Hides the new workout form' : 'Shows the new workout form'}
            style={{ alignSelf: 'flex-start', marginBottom: 16 }}
          />

          {showWForm && (
            <View style={{ backgroundColor: T.bgInput, borderRadius: R.xl, padding: 16, borderWidth: 1, borderColor: T.bgInputActive, marginBottom: 16 }}>
              <Field label="Workout name" value={wName} onChangeText={name => patchW({ name })} placeholder="Workout name…" />
              <Text style={{ color: T.textSub, fontSize: 13, marginBottom: 7 }}>Goal</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                {GOALS.map(g => <Chip key={g} label={humanize(g)} a11y={`Goal: ${g}`} active={wGoal === g} onPress={() => patchW({ goal: g })} />)}
              </View>
              <Text style={{ color: T.textSub, fontSize: 13, marginBottom: 7 }}>Difficulty</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                {DIFFS.map(d => <Pressable key={d} onPress={() => patchW({ diff: d })}
                  hitSlop={4}
                  accessibilityRole="button"
                  accessibilityLabel={`Difficulty: ${d}`}
                  accessibilityState={{ selected: wDiff === d }}
                  style={{ flex: 1, minHeight: 36, justifyContent: 'center', paddingVertical: 8, borderRadius: 12, alignItems: 'center', backgroundColor: wDiff === d ? withAlpha(T.brand, 0.12) : T.bgInputActive, borderWidth: 1, borderColor: wDiff === d ? withAlpha(T.brand, 0.35) : T.line }}>
                  <Text numberOfLines={1} style={{ color: wDiff === d ? T.brand : T.textSub, fontSize: 11, fontWeight: '700' }}>{d}</Text>
                </Pressable>)}
              </View>
              <Field label="Duration (min)" value={wDuration} onChangeText={duration => patchW({ duration })} placeholder="Duration (min)…" keyboardType="numeric" />
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

      {/* ── Plans: the shared weekly plan builder list ── */}
      {tab === 'plans' && <PlansList embedded onOpenPlan={onOpenPlan} />}

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
