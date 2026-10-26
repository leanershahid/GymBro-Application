import React, { useState } from 'react';
import { currentTenantId } from '../../../api/session';
import {
  View, Text, ScrollView, Pressable,
  Platform, Alert, KeyboardAvoidingView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useExerciseList } from '../../member-app/api/memberAppQueries';
import { useWorkouts, useCreateWorkout, usePlans, useCreatePlan } from '../../workouts/api/workoutQueries';
import { WorkoutPayload, WorkoutPlanPayload, WorkoutGoal, WorkoutDifficulty } from '../../workouts/types/workout.types';
import { T, R, withAlpha } from '../../../theme';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import SegmentedTabs from '../../common/components/SegmentedTabs';
import SearchBar from '../../common/components/SearchBar';
import PrimaryButton from '../../common/components/PrimaryButton';
import Skeleton from '../../common/components/Skeleton';
import StatusPill from '../../common/components/StatusPill';
import { Field } from '../../trainers/components/FormFields';
import { difficultyTone, goalTone } from '../../member-app/components/pillTones';

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

function ComingSoonBanner({ feature }: { feature: string }) {
  return (
    <View style={{ backgroundColor: T.bgInput, borderRadius: R.lg, padding: 20, borderWidth: 1, borderColor: T.bgInputActive, alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: withAlpha(T.violet, 0.12), borderWidth: 1, borderColor: withAlpha(T.violet, 0.25), alignItems: 'center', justifyContent: 'center' }}>
        <Feather name="cpu" size={22} color={T.violet} />
      </View>
      <Text style={{ color: T.text, fontSize: 14, fontWeight: '700' }}>{feature}</Text>
      <StatusPill label="COMING SOON" tone="neutral" />
    </View>
  );
}

type Tab = 'exercises' | 'workouts' | 'plans' | 'ai';

interface Props { trainerId: number; onBack?: () => void; }

export default function ProgramBuilderScreen({ trainerId, onBack }: Props) {
  const [tab, setTab]           = useState<Tab>('workouts');
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
  const { data: exPaged, isLoading: exLoad, refetch: exRefetch } = useExerciseList(exPage, tagParam);
  const { data: wPaged,  isLoading: wLoad,  refetch: wRefetch  } = useWorkouts(wPage, 20);
  const { data: pPaged,  isLoading: pLoad,  refetch: pRefetch  } = usePlans(pPage, 20);
  const { mutate: createWorkout, isPending: creating } = useCreateWorkout();
  const { mutate: createPlan,    isPending: creatingPlan } = useCreatePlan();

  const exercises = exPaged?.items ?? [];
  const workouts  = wPaged?.items  ?? [];
  const plans     = pPaged?.items  ?? [];

  const filteredEx = exSearch.trim() ? exercises.filter(e => e.name.toLowerCase().includes(exSearch.toLowerCase())) : exercises;

  const handleCreateWorkout = () => {
    if (!wName.trim()) return;
    const payload: WorkoutPayload = { tenantId: currentTenantId(), name: wName.trim(), goal: wGoal, difficulty: wDiff, durationMin: wDuration ? Number(wDuration) : undefined, isPublic: false };
    createWorkout(payload, {
      onSuccess: res => { if (res.success) { Alert.alert('Created ✓', 'Workout created.'); setShowWForm(false); setWName(''); wRefetch(); } },
      onError:   () => Alert.alert('Error', 'Failed to create workout.'),
    });
  };

  const handleCreatePlan = () => {
    if (!pName.trim() || !pWeeks) return;
    const payload: WorkoutPlanPayload = { tenantId: currentTenantId(), name: pName.trim(), durationWeeks: Number(pWeeks), goal: pGoal };
    createPlan(payload, {
      onSuccess: res => { if (res.success) { Alert.alert('Created ✓', 'Plan created.'); setShowPForm(false); setPName(''); pRefetch(); } },
      onError:   () => Alert.alert('Error', 'Failed to create plan.'),
    });
  };

  const EX_FILTERS = ['All', 'Strength', 'Cardio', 'Flexibility', 'Balance'];
  const GOALS: WorkoutGoal[] = ['General', 'WeightLoss', 'MuscleGain', 'Endurance'];
  const DIFFS: WorkoutDifficulty[] = ['Beginner', 'Intermediate', 'Advanced'];

  return (
    <Screen>

      {/* Header */}
      <ScreenHeader eyebrow="Trainer" title="Program Builder" onBack={onBack} />
      <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
        {/* Tabs */}
        <SegmentedTabs<Tab>
          tabs={[
            { key: 'exercises', label: 'Exercises' },
            { key: 'workouts',  label: 'Workouts' },
            { key: 'plans',     label: 'Plans' },
            { key: 'ai',        label: 'AI Draft' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

      {/* ── Exercise Library ── */}
      {tab === 'exercises' && (
        <>
          <View style={{ paddingHorizontal: 20, paddingBottom: 10 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 10 }}>
              {EX_FILTERS.map(f => {
                const a = f === exFilter;
                return (
                  <Pressable key={f} onPress={() => { setExFilter(f); setExPage(1); }}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={`Filter: ${f}`}
                    accessibilityState={{ selected: a }}
                    style={{ minHeight: 36, justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: a ? T.brand : T.bgInput, borderWidth: 1, borderColor: a ? T.brand : T.line }}>
                    <Text style={{ color: a ? T.onBrand : T.textSub, fontSize: 12, fontWeight: '700' }}>{f}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <SearchBar value={exSearch} onChangeText={setExSearch} placeholder="Search…" label="Search exercises" />
          </View>
          <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
            {exLoad && <Skeleton rows={3} height={90} />}
            {!exLoad && filteredEx.map(ex => {
              const diff  = ex.difficulty?.toLowerCase() ?? 'beginner';
              const cat   = ex.category?.toLowerCase()   ?? 'strength';
              const color = DIFF_COLOR[diff] ?? T.textSub;
              const icon  = CAT_ICON[cat]   ?? 'zap';
              return (
                <View key={ex.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: T.bgInput, borderRadius: R.lg, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: T.bgInputActive }}>
                  <View style={{ width: 60, height: 60, borderRadius: 12, backgroundColor: T.bgInputActive, borderWidth: 1, borderColor: T.line, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                    <Feather name={icon} size={26} color={color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: T.text, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>{ex.name}</Text>
                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                      {ex.category && <StatusPill label={ex.category} tone="neutral" />}
                      {ex.difficulty && <StatusPill label={ex.difficulty} tone={difficultyTone(ex.difficulty)} />}
                    </View>
                  </View>
                  <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: T.brand, alignItems: 'center', justifyContent: 'center' }}>
                    <Feather name="plus" size={16} color={T.onBrand} />
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </>
      )}

      {/* ── Workouts ── */}
      {tab === 'workouts' && (
        <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
          {/* Create form */}
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
                {GOALS.map(g => <Pressable key={g} onPress={() => setWGoal(g)}
                  hitSlop={4}
                  accessibilityRole="button"
                  accessibilityLabel={`Goal: ${g}`}
                  accessibilityState={{ selected: wGoal === g }}
                  style={{ minHeight: 36, justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: wGoal === g ? T.brand : T.bgInputActive, borderWidth: 1, borderColor: wGoal === g ? T.brand : T.line }}>
                  <Text style={{ color: wGoal === g ? T.onBrand : T.textSub, fontSize: 11, fontWeight: '700' }}>{g}</Text>
                </Pressable>)}
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
              <PrimaryButton label="Create Workout" onPress={handleCreateWorkout} loading={creating} disabled={!wName.trim()} />
            </View>
          )}

          {wLoad && <Skeleton rows={3} height={90} />}
          {!wLoad && workouts.map(w => {
            return (
              <View key={w.id} style={{ backgroundColor: T.bgInput, borderRadius: R.lg, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: T.bgInputActive }}>
                <Text numberOfLines={1} style={{ color: T.text, fontSize: 15, fontWeight: '700', marginBottom: 8 }}>{w.name}</Text>
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                  {w.goal && <StatusPill label={w.goal} tone={goalTone(w.goal)} />}
                  {w.difficulty && <StatusPill label={w.difficulty} tone="neutral" />}
                  {!!w.durationMin && <View style={{ backgroundColor: T.bgInputActive, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: T.line, flexDirection: 'row', alignItems: 'center', gap: 4 }}><Feather name="clock" size={9} color={T.textFaint} /><Text style={{ color: T.textSub, fontSize: 11 }}>{w.durationMin}m</Text></View>}
                </View>
              </View>
            );
          })}
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
                {GOALS.map(g => <Pressable key={g} onPress={() => setPGoal(g)}
                  hitSlop={4}
                  accessibilityRole="button"
                  accessibilityLabel={`Goal: ${g}`}
                  accessibilityState={{ selected: pGoal === g }}
                  style={{ minHeight: 36, justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: pGoal === g ? T.brand : T.bgInputActive, borderWidth: 1, borderColor: pGoal === g ? T.brand : T.line }}>
                  <Text style={{ color: pGoal === g ? T.onBrand : T.textSub, fontSize: 11, fontWeight: '700' }}>{g}</Text>
                </Pressable>)}
              </View>
              <PrimaryButton label="Create Plan" onPress={handleCreatePlan} loading={creatingPlan} disabled={!pName.trim() || !pWeeks} />
            </View>
          )}

          {pLoad && <Skeleton rows={3} height={90} />}
          {!pLoad && plans.map(plan => {
            const gc = GOAL_COLOR[plan.goal?.toLowerCase() ?? 'general'] ?? T.textSub;
            return (
              <View key={plan.id} style={{ backgroundColor: T.bgInput, borderRadius: R.lg, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: T.bgInputActive }}>
                <View style={{ height: 3, backgroundColor: gc, borderRadius: 2, marginBottom: 12, width: 36 }} />
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <Text numberOfLines={2} style={{ color: T.text, fontSize: 15, fontWeight: '700', flex: 1, paddingRight: 10 }}>{plan.name}</Text>
                  <View style={{ backgroundColor: withAlpha(T.brand, 0.10), borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center', borderWidth: 1, borderColor: withAlpha(T.brand, 0.25) }}>
                    <Text style={{ color: T.brand, fontSize: 16, fontWeight: '800' }}>{plan.durationWeeks}</Text>
                    <Text style={{ color: T.textSub, fontSize: 11 }}>WKS</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* ── AI Draft ── */}
      {tab === 'ai' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
          <ComingSoonBanner feature="AI Workout Generator" />
          <ComingSoonBanner feature="Injury Risk Detection" />
          <ComingSoonBanner feature="Client Churn Prediction" />
          <ComingSoonBanner feature="Form Scoring & Analysis" />
        </ScrollView>
      )}
      </KeyboardAvoidingView>
    </Screen>
  );
}
