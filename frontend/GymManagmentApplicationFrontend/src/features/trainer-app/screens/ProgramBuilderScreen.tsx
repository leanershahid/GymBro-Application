import React, { useRef, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput,
  StatusBar, Platform, Animated, Alert, ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useExerciseList } from '../../member-app/api/memberAppQueries';
import { useWorkouts, useCreateWorkout, usePlans, useCreatePlan } from '../../workouts/api/workoutQueries';
import { WorkoutPayload, WorkoutPlanPayload, WorkoutGoal, WorkoutDifficulty } from '../../workouts/types/workout.types';

type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

const GOAL_COLOR: Record<string, string> = {
  general: '#AAAAAA', weightloss: '#22D3EE', musclegain: '#7ED321', endurance: '#FACC15',
};
const CAT_ICON: Record<string, FeatherIconName> = {
  strength: 'zap', cardio: 'activity', flexibility: 'wind', balance: 'target',
};
const DIFF_COLOR: Record<string, string> = {
  beginner: '#22C55E', intermediate: '#FACC15', advanced: '#EF4444',
};

function Skeleton({ count = 3, h = 90 }: { count?: number; h?: number }) {
  const op = useRef(new Animated.Value(0.25)).current;
  React.useEffect(() => {
    const l = Animated.loop(Animated.sequence([
      Animated.timing(op, { toValue: 0.65, duration: 700, useNativeDriver: true }),
      Animated.timing(op, { toValue: 0.25, duration: 700, useNativeDriver: true }),
    ]));
    l.start(); return () => l.stop();
  }, []);
  return <>{Array.from({ length: count }).map((_, k) => <Animated.View key={k} style={{ height: h, borderRadius: 18, backgroundColor: '#151915', marginBottom: 10, opacity: op }} />)}</>;
}

function ComingSoonBanner({ feature }: { feature: string }) {
  return (
    <View style={{ backgroundColor: '#151915', borderRadius: 18, padding: 20, borderWidth: 1, borderColor: '#1C211C', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(167,139,250,0.12)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.25)', alignItems: 'center', justifyContent: 'center' }}>
        <Feather name="cpu" size={22} color="#A78BFA" />
      </View>
      <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' }}>{feature}</Text>
      <View style={{ backgroundColor: '#1C211C', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, borderWidth: 1, borderColor: '#242B24' }}>
        <Text style={{ color: '#666', fontSize: 11, fontWeight: '700' }}>COMING SOON</Text>
      </View>
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
    const payload: WorkoutPayload = { tenantId: 1, name: wName.trim(), goal: wGoal, difficulty: wDiff, durationMin: wDuration ? Number(wDuration) : undefined, isPublic: false };
    createWorkout(payload, {
      onSuccess: res => { if (res.success) { Alert.alert('Created ✓', 'Workout created.'); setShowWForm(false); setWName(''); wRefetch(); } },
      onError:   () => Alert.alert('Error', 'Failed to create workout.'),
    });
  };

  const handleCreatePlan = () => {
    if (!pName.trim() || !pWeeks) return;
    const payload: WorkoutPlanPayload = { tenantId: 1, name: pName.trim(), durationWeeks: Number(pWeeks), goal: pGoal };
    createPlan(payload, {
      onSuccess: res => { if (res.success) { Alert.alert('Created ✓', 'Plan created.'); setShowPForm(false); setPName(''); pRefetch(); } },
      onError:   () => Alert.alert('Error', 'Failed to create plan.'),
    });
  };

  const EX_FILTERS = ['All', 'Strength', 'Cardio', 'Flexibility', 'Balance'];
  const GOALS: WorkoutGoal[] = ['General', 'WeightLoss', 'MuscleGain', 'Endurance'];
  const DIFFS: WorkoutDifficulty[] = ['Beginner', 'Intermediate', 'Advanced'];

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0F0A', paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0 }}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0F0A" />

      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          {onBack && (
            <Pressable onPress={onBack} hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#151915', borderWidth: 1, borderColor: '#242B24', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
              <Feather name="arrow-left" size={18} color="#FFFFFF" />
            </Pressable>
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#AAAAAA', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>Trainer</Text>
            <Text style={{ color: '#FFFFFF', fontSize: 26, fontWeight: '800', letterSpacing: -0.5 }}>Program Builder</Text>
          </View>
        </View>

        {/* Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {(['exercises', 'workouts', 'plans', 'ai'] as Tab[]).map(t => (
            <Pressable key={t} onPress={() => setTab(t)}
              style={{ paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, backgroundColor: tab === t ? '#7ED321' : '#151915', borderWidth: 1, borderColor: tab === t ? '#7ED321' : '#242B24' }}>
              <Text style={{ color: tab === t ? '#000' : '#AAAAAA', fontSize: 12, fontWeight: '700', textTransform: 'capitalize' }}>{t === 'ai' ? 'AI Draft' : t}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* ── Exercise Library ── */}
      {tab === 'exercises' && (
        <>
          <View style={{ paddingHorizontal: 20, paddingBottom: 10 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 10 }}>
              {EX_FILTERS.map(f => {
                const a = f === exFilter;
                return (
                  <Pressable key={f} onPress={() => { setExFilter(f); setExPage(1); }}
                    style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: a ? '#7ED321' : '#151915', borderWidth: 1, borderColor: a ? '#7ED321' : '#242B24' }}>
                    <Text style={{ color: a ? '#000' : '#AAAAAA', fontSize: 12, fontWeight: '700' }}>{f}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#151915', borderRadius: 14, borderWidth: 1, borderColor: '#242B24', paddingHorizontal: 12, height: 44 }}>
              <Feather name="search" size={14} color="#555" style={{ marginRight: 8 }} />
              <TextInput style={{ flex: 1, color: '#FFF', fontSize: 14 }} placeholder="Search…" placeholderTextColor="#555"
                value={exSearch} onChangeText={setExSearch} autoCapitalize="none" autoCorrect={false} />
              {exSearch.length > 0 && (
                <Pressable onPress={() => setExSearch('')} hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Clear search">
                  <Feather name="x" size={13} color="#555" />
                </Pressable>
              )}
            </View>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
            {exLoad && <Skeleton />}
            {!exLoad && filteredEx.map(ex => {
              const diff  = ex.difficulty?.toLowerCase() ?? 'beginner';
              const cat   = ex.category?.toLowerCase()   ?? 'strength';
              const color = DIFF_COLOR[diff] ?? '#AAAAAA';
              const icon  = CAT_ICON[cat]   ?? 'zap';
              return (
                <View key={ex.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#151915', borderRadius: 18, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#1C211C' }}>
                  <View style={{ width: 60, height: 60, borderRadius: 12, backgroundColor: '#1C211C', borderWidth: 1, borderColor: '#242B24', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                    <Feather name={icon} size={26} color={color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' }} numberOfLines={1}>{ex.name}</Text>
                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                      {ex.category && <View style={{ backgroundColor: '#1C211C', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: '#242B24' }}><Text style={{ color: '#AAAAAA', fontSize: 11 }}>{ex.category}</Text></View>}
                      {ex.difficulty && <View style={{ backgroundColor: color + '15', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: color + '35' }}><Text style={{ color, fontSize: 11, fontWeight: '700' }}>{ex.difficulty}</Text></View>}
                    </View>
                  </View>
                  <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: '#7ED321', alignItems: 'center', justifyContent: 'center' }}>
                    <Feather name="plus" size={16} color="#000" />
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </>
      )}

      {/* ── Workouts ── */}
      {tab === 'workouts' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
          {/* Create form */}
          <Pressable onPress={() => setShowWForm(v => !v)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#7ED321', borderRadius: 999, paddingHorizontal: 18, paddingVertical: 12, marginBottom: 14, alignSelf: 'flex-start' }}>
            <Feather name={showWForm ? 'chevron-up' : 'plus'} size={16} color="#000" />
            <Text style={{ color: '#000', fontSize: 13, fontWeight: '700' }}>New Workout</Text>
          </Pressable>

          {showWForm && (
            <View style={{ backgroundColor: '#151915', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#1C211C', marginBottom: 14 }}>
              <TextInput style={{ backgroundColor: '#1C211C', borderRadius: 12, borderWidth: 1, borderColor: '#242B24', color: '#FFF', padding: 12, fontSize: 14, marginBottom: 10 }}
                value={wName} onChangeText={setWName} placeholder="Workout name…" placeholderTextColor="#555" />
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                {GOALS.map(g => <Pressable key={g} onPress={() => setWGoal(g)}
                  style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: wGoal === g ? '#7ED321' : '#1C211C', borderWidth: 1, borderColor: wGoal === g ? '#7ED321' : '#242B24' }}>
                  <Text style={{ color: wGoal === g ? '#000' : '#AAA', fontSize: 11, fontWeight: '700' }}>{g}</Text>
                </Pressable>)}
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                {DIFFS.map(d => <Pressable key={d} onPress={() => setWDiff(d)}
                  style={{ flex: 1, paddingVertical: 8, borderRadius: 12, alignItems: 'center', backgroundColor: wDiff === d ? 'rgba(126,211,33,0.12)' : '#1C211C', borderWidth: 1, borderColor: wDiff === d ? 'rgba(126,211,33,0.35)' : '#242B24' }}>
                  <Text style={{ color: wDiff === d ? '#7ED321' : '#AAA', fontSize: 11, fontWeight: '700' }}>{d}</Text>
                </Pressable>)}
              </View>
              <TextInput style={{ backgroundColor: '#1C211C', borderRadius: 12, borderWidth: 1, borderColor: '#242B24', color: '#FFF', padding: 12, fontSize: 14, marginBottom: 12 }}
                value={wDuration} onChangeText={setWDuration} placeholder="Duration (min)…" placeholderTextColor="#555" keyboardType="numeric" />
              <Pressable onPress={handleCreateWorkout} disabled={creating || !wName.trim()}
                style={{ backgroundColor: !wName.trim() ? '#242B24' : '#7ED321', borderRadius: 999, paddingVertical: 12, alignItems: 'center', opacity: creating ? 0.7 : 1 }}>
                {creating ? <ActivityIndicator color="#000" /> : <Text style={{ color: '#000', fontWeight: '700' }}>Create Workout</Text>}
              </Pressable>
            </View>
          )}

          {wLoad && <Skeleton />}
          {!wLoad && workouts.map(w => {
            const gc = GOAL_COLOR[w.goal?.toLowerCase() ?? 'general'] ?? '#AAAAAA';
            return (
              <View key={w.id} style={{ backgroundColor: '#151915', borderRadius: 18, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#1C211C' }}>
                <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700', marginBottom: 8 }}>{w.name}</Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {w.goal && <View style={{ backgroundColor: gc + '15', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: gc + '35' }}><Text style={{ color: gc, fontSize: 11, fontWeight: '700' }}>{w.goal}</Text></View>}
                  {w.difficulty && <View style={{ backgroundColor: '#1C211C', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: '#242B24' }}><Text style={{ color: '#AAAAAA', fontSize: 11 }}>{w.difficulty}</Text></View>}
                  {w.durationMin && <View style={{ backgroundColor: '#1C211C', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: '#242B24', flexDirection: 'row', alignItems: 'center', gap: 4 }}><Feather name="clock" size={9} color="#777" /><Text style={{ color: '#AAA', fontSize: 11 }}>{w.durationMin}m</Text></View>}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* ── Plans ── */}
      {tab === 'plans' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
          <Pressable onPress={() => setShowPForm(v => !v)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#7ED321', borderRadius: 999, paddingHorizontal: 18, paddingVertical: 12, marginBottom: 14, alignSelf: 'flex-start' }}>
            <Feather name={showPForm ? 'chevron-up' : 'plus'} size={16} color="#000" />
            <Text style={{ color: '#000', fontSize: 13, fontWeight: '700' }}>New Plan</Text>
          </Pressable>

          {showPForm && (
            <View style={{ backgroundColor: '#151915', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#1C211C', marginBottom: 14 }}>
              <TextInput style={{ backgroundColor: '#1C211C', borderRadius: 12, borderWidth: 1, borderColor: '#242B24', color: '#FFF', padding: 12, fontSize: 14, marginBottom: 10 }}
                value={pName} onChangeText={setPName} placeholder="Plan name…" placeholderTextColor="#555" />
              <TextInput style={{ backgroundColor: '#1C211C', borderRadius: 12, borderWidth: 1, borderColor: '#242B24', color: '#FFF', padding: 12, fontSize: 14, marginBottom: 10 }}
                value={pWeeks} onChangeText={setPWeeks} placeholder="Duration (weeks)…" placeholderTextColor="#555" keyboardType="numeric" />
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                {GOALS.map(g => <Pressable key={g} onPress={() => setPGoal(g)}
                  style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: pGoal === g ? '#7ED321' : '#1C211C', borderWidth: 1, borderColor: pGoal === g ? '#7ED321' : '#242B24' }}>
                  <Text style={{ color: pGoal === g ? '#000' : '#AAA', fontSize: 11, fontWeight: '700' }}>{g}</Text>
                </Pressable>)}
              </View>
              <Pressable onPress={handleCreatePlan} disabled={creatingPlan || !pName.trim() || !pWeeks}
                style={{ backgroundColor: (!pName.trim() || !pWeeks) ? '#242B24' : '#7ED321', borderRadius: 999, paddingVertical: 12, alignItems: 'center', opacity: creatingPlan ? 0.7 : 1 }}>
                {creatingPlan ? <ActivityIndicator color="#000" /> : <Text style={{ color: '#000', fontWeight: '700' }}>Create Plan</Text>}
              </Pressable>
            </View>
          )}

          {pLoad && <Skeleton />}
          {!pLoad && plans.map(plan => {
            const gc = GOAL_COLOR[plan.goal?.toLowerCase() ?? 'general'] ?? '#AAAAAA';
            return (
              <View key={plan.id} style={{ backgroundColor: '#151915', borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#1C211C' }}>
                <View style={{ height: 3, backgroundColor: gc, borderRadius: 2, marginBottom: 12, width: 36 }} />
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700', flex: 1, paddingRight: 10 }}>{plan.name}</Text>
                  <View style={{ backgroundColor: 'rgba(126,211,33,0.10)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(126,211,33,0.25)' }}>
                    <Text style={{ color: '#7ED321', fontSize: 16, fontWeight: '800' }}>{plan.durationWeeks}</Text>
                    <Text style={{ color: '#AAA', fontSize: 11 }}>WKS</Text>
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
    </View>
  );
}
