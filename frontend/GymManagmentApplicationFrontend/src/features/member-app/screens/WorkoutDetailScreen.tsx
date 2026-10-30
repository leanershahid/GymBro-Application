import React, { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput,
  Platform, Alert, ImageBackground, KeyboardAvoidingView, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import {
  useWorkoutDetail, useWorkoutStructure, useCompleteWorkout, useBookmarkWorkout,
} from '../api/memberAppQueries';
import { useIsBookmarked } from '../api/bookmarkStore';
import { StructureExercise, WorkoutSection, WorkoutSetLog } from '../types/member-app.types';
import { T, R, withAlpha } from '../../../theme';
import { apiErrorText } from '../../../api/apiError';
import Screen from '../../common/components/Screen';
import BackButton from '../../common/components/BackButton';
import PrimaryButton from '../../common/components/PrimaryButton';
import LoadingState from '../../common/components/LoadingState';
import StatusPill, { PillTone } from '../../common/components/StatusPill';
import Skeleton from '../../common/components/Skeleton';
import { useToast } from '../../common/components/Toast';
import EmptyState from '../../dashboard/components/EmptyState';
import { difficultyTone } from '../components/pillTones';
import { fmtSeconds, statusLabel } from '../components/trainingUtils';

const IMG_HERO = require('../../../assets/dashboard/workout-1.jpg');

interface SetRowState { reps: string; weight: string; rpe: string; done: boolean; }

interface Props { workoutId: number; userId: number; onBack: () => void; }

const SECTION_TONE: Record<string, PillTone> = {
  warmup: 'warn', main: 'brand', cooldown: 'info', circuit: 'violet', superset: 'violet', dropset: 'err', pyramid: 'warn',
};

/** One row key per exercise slot — the same exercise can appear in several sections. */
const slotKey = (si: number, ei: number) => `${si}-${ei}`;
const setCount = (ex: StructureExercise, s: WorkoutSection) => Math.max(1, ex.sets ?? s.rounds ?? 1);
const isTimed = (ex: StructureExercise) => !ex.reps && ex.durationSeconds != null;
const emptyRows = (n: number): SetRowState[] => Array.from({ length: n }, () => ({ reps: '', weight: '', rpe: '', done: false }));

function prescription(ex: StructureExercise, s: WorkoutSection): string {
  const n = ex.sets ?? (s.rounds > 1 ? s.rounds : null);
  const work = ex.reps ? `${ex.reps} reps` : ex.durationSeconds != null ? fmtSeconds(ex.durationSeconds) : null;
  return [
    n && work ? `${n} × ${work}` : work ?? (n ? `${n} sets` : null),
    ex.restSeconds != null ? `${fmtSeconds(ex.restSeconds)} rest` : null,
    ex.tempo ? `tempo ${ex.tempo}` : null,
  ].filter(Boolean).join(' · ');
}

export default function WorkoutDetailScreen({ workoutId, userId, onBack }: Props) {
  const { data: workout, isLoading, isError, refetch } = useWorkoutDetail(workoutId);
  const structureQ = useWorkoutStructure(workoutId);
  const { mutate: complete, isPending } = useCompleteWorkout();
  const { mutate: toggleBookmark, isPending: bookmarking } = useBookmarkWorkout();
  const bookmarked = useIsBookmarked(workoutId);
  const toast = useToast();

  const [sets, setSets] = useState<Record<string, SetRowState[]>>({});
  const [notes, setNotes] = useState('');
  const [mood, setMood]   = useState('');
  const [started] = useState(new Date().toISOString());
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const heroH = Math.min(240, Math.round(winH * 0.3));

  const sections = structureQ.data?.sections ?? [];
  const exerciseCount = sections.reduce((n, s) => n + s.exercises.length, 0);

  const updateSet = (key: string, count: number, idx: number, field: keyof SetRowState, val: string | boolean) => {
    setSets(prev => {
      const rows = [...(prev[key] ?? emptyRows(count))];
      rows[idx] = { ...rows[idx], [field]: val };
      return { ...prev, [key]: rows };
    });
  };

  const onBookmark = () => toggleBookmark(workoutId, {
    onSuccess: saved => toast.show({ type: 'success', message: saved ? 'Workout saved.' : 'Removed from saved.' }),
    onError: e => toast.show({ type: 'error', message: apiErrorText(e) }),
  });

  const handleComplete = () => {
    const allSets: WorkoutSetLog[] = [];
    sections.forEach((s, si) => s.exercises.forEach((ex, ei) => {
      const timed = isTimed(ex);
      (sets[slotKey(si, ei)] ?? []).forEach((r, i) => {
        if (!r.done) return;
        if (!timed && !r.reps) return;
        allSets.push({
          exerciseId:  ex.exerciseId,
          setNo:       i + 1,
          reps:        timed ? 0 : Number(r.reps) || 0,
          durationSec: timed ? (Number(r.reps) || ex.durationSeconds || 0) : undefined,
          weightKg:    Number(r.weight) || 0,
          rpe:         r.rpe ? Number(r.rpe) : undefined,
        });
      });
    }));

    if (allSets.length === 0) {
      Alert.alert('No sets logged', 'Mark at least one set as done before finishing.');
      return;
    }

    complete({
      id: workoutId,
      payload: {
        clientId:   userId,
        startedAt:  started,
        endedAt:    new Date().toISOString(),
        notes:      notes || undefined,
        moodBefore: mood ? Number(mood) : undefined,
        sets:       allSets,
      },
    }, {
      onSuccess: res => res.success
        ? toast.show({ type: 'success', message: res.message || 'Workout logged!' })
        : toast.show({ type: 'error', message: res.message || 'Could not log workout.' }),
      onError: e => toast.show({ type: 'error', message: apiErrorText(e) }),
    });
  };

  if (isLoading) return <LoadingState fullScreen label="Loading workout" />;

  if (isError || !workout) return (
    <Screen>
      <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
        <BackButton onPress={onBack} />
      </View>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <EmptyState icon="wifi-off" tone="error" title="Failed to load" action={{ label: 'Retry', onPress: () => refetch() }} />
      </View>
    </Screen>
  );

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {/* ── Hero ── */}
        <View style={{ height: heroH, position: 'relative' }}>
          <ImageBackground source={IMG_HERO} style={{ flex: 1 }} resizeMode="cover">
            <View style={{ flex: 1, backgroundColor: T.overlay }}>
              <View style={{ position: 'absolute', top: 16, left: 20 }}>
                <BackButton onPress={onBack} variant="overlay" />
              </View>

              {/* Bookmark toggle — filled when saved this session */}
              <Pressable
                onPress={onBookmark}
                disabled={bookmarking}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={bookmarked ? 'Remove from saved workouts' : 'Save workout'}
                accessibilityState={{ selected: bookmarked, busy: bookmarking }}
                style={{
                  position: 'absolute', top: 16, right: 20, width: 40, height: 40, borderRadius: 20,
                  backgroundColor: T.overlay, borderWidth: 1, borderColor: withAlpha(T.text, 0.18),
                  alignItems: 'center', justifyContent: 'center', opacity: bookmarking ? 0.6 : 1,
                }}>
                <Ionicons name={bookmarked ? 'bookmark' : 'bookmark-outline'} size={18} color={bookmarked ? T.brand : T.text} />
              </Pressable>

              {(workout.durationMin != null || !!workout.difficulty) && (
              <View style={{ position: 'absolute', bottom: 16, alignSelf: 'center', backgroundColor: T.overlay, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: withAlpha(T.text, 0.18) }}>
                {workout.durationMin != null && (
                  <>
                    <Feather name="clock" size={14} color={T.brand} />
                    <Text style={{ color: T.text, fontSize: 13, fontWeight: '600' }}>~{workout.durationMin} min</Text>
                  </>
                )}
                {workout.durationMin != null && !!workout.difficulty && (
                  <View style={{ width: 1, height: 12, backgroundColor: withAlpha(T.text, 0.25) }} />
                )}
                {!!workout.difficulty && (
                  <StatusPill label={workout.difficulty} tone={difficultyTone(workout.difficulty)} />
                )}
              </View>
              )}
            </View>
          </ImageBackground>
        </View>

        {/* ── Title ── */}
        <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 }}>
          <Text style={{ color: T.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginBottom: 6 }}>
            {workout.name}
          </Text>
          {!!workout.description && (
            <Text style={{ color: T.textSub, fontSize: 13, lineHeight: 20 }}>{workout.description}</Text>
          )}
        </View>

        {/* ── Sections → exercises ── */}
        <View style={{ paddingHorizontal: 20 }}>
          <Text style={{ color: T.text, fontSize: 17, fontWeight: '700', marginBottom: 14 }}>
            Exercises{structureQ.data ? ` (${exerciseCount})` : ''}
          </Text>

          {structureQ.isLoading && <Skeleton rows={3} height={120} borderRadius={R.xl} gap={14} />}

          {structureQ.isError && (
            <EmptyState icon="wifi-off" tone="error" title="Couldn't load exercises"
              action={{ label: 'Retry', onPress: () => structureQ.refetch() }} />
          )}

          {structureQ.data && exerciseCount === 0 && (
            <EmptyState icon="list" title="No exercises yet" subtitle="Your trainer hasn't added exercises to this workout." />
          )}

          {sections.map((s, si) => s.exercises.length === 0 ? null : (
            <View key={si} style={{ marginBottom: 6 }}>
              {/* Section header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                <Text style={{ color: T.text, fontSize: 15, fontWeight: '700' }}>{s.name || statusLabel(s.type)}</Text>
                <StatusPill label={statusLabel(s.type)} tone={SECTION_TONE[s.type.toLowerCase()] ?? 'neutral'} />
                {s.rounds > 1 && <StatusPill label={`${s.rounds} rounds`} tone="neutral" />}
                {s.restSeconds != null && (
                  <Text style={{ color: T.textFaint, fontSize: 12 }}>{fmtSeconds(s.restSeconds)} between rounds</Text>
                )}
              </View>

              {s.exercises.map((ex, ei) => {
                const key = slotKey(si, ei);
                const count = setCount(ex, s);
                const timed = isTimed(ex);
                const rows = sets[key] ?? emptyRows(count);
                const name = ex.exerciseName ?? `Exercise #${ex.exerciseId}`;
                return (
                  <View key={key} style={{ backgroundColor: T.bgInput, borderRadius: R.xl, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: T.bgInputActive }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 }}>
                      <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: T.bgInputActive, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                        <Text style={{ color: T.brand, fontSize: 13, fontWeight: '900' }}>{ei + 1}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: T.text, fontSize: 15, fontWeight: '700' }} numberOfLines={2}>{name}</Text>
                        {!!prescription(ex, s) && (
                          <Text style={{ color: T.textSub, fontSize: 12, marginTop: 2 }}>{prescription(ex, s)}</Text>
                        )}
                        {!!ex.weightSuggestion && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                            <Feather name="trending-up" size={11} color={T.brandGold} />
                            <Text style={{ color: T.brandGold, fontSize: 12, fontWeight: '600' }}>{ex.weightSuggestion}</Text>
                          </View>
                        )}
                        {!!ex.notes && (
                          <Text style={{ color: T.textFaint, fontSize: 12, marginTop: 4, fontStyle: 'italic' }}>{ex.notes}</Text>
                        )}
                      </View>
                    </View>

                    {/* Column headers */}
                    <View style={{ flexDirection: 'row', marginBottom: 8 }}>
                      <Text style={{ width: 36, color: T.textFaint, fontSize: 11, fontWeight: '600' }}>SET</Text>
                      <Text style={{ flex: 1, color: T.textFaint, fontSize: 11, fontWeight: '600', textAlign: 'center' }}>{timed ? 'SEC' : 'REPS'}</Text>
                      <Text style={{ flex: 1, color: T.textFaint, fontSize: 11, fontWeight: '600', textAlign: 'center' }}>KG</Text>
                      <Text style={{ flex: 1, color: T.textFaint, fontSize: 11, fontWeight: '600', textAlign: 'center' }}>RPE</Text>
                      <Text style={{ width: 36, color: T.textFaint, fontSize: 11, fontWeight: '600', textAlign: 'center' }}>DONE</Text>
                    </View>

                    {rows.map((row, ri) => (
                      <View key={ri} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                        <Text style={{ width: 36, color: T.textSub, fontSize: 12, fontWeight: '700' }}>{ri + 1}</Text>
                        {(['reps', 'weight', 'rpe'] as const).map(field => (
                          <TextInput key={field}
                            accessibilityLabel={`${name} set ${ri + 1} ${field === 'reps' ? (timed ? 'seconds' : 'reps') : field === 'weight' ? 'kilograms' : 'RPE'}`}
                            style={{ flex: 1, minWidth: 0, backgroundColor: T.bgInputActive, borderRadius: 10, height: 36, textAlign: 'center', color: row.done ? T.brand : T.text, fontSize: 13, fontWeight: '600', marginHorizontal: 3, borderWidth: 1, borderColor: row.done ? withAlpha(T.brand, 0.30) : T.line }}
                            value={row[field]}
                            onChangeText={v => updateSet(key, count, ri, field, v)}
                            keyboardType="numeric"
                            placeholder={field === 'rpe' ? '—' : field === 'reps' && timed && ex.durationSeconds != null ? String(ex.durationSeconds) : '0'}
                            placeholderTextColor={T.textDisabled}
                            editable={!row.done}
                          />
                        ))}
                        <Pressable onPress={() => updateSet(key, count, ri, 'done', !row.done)}
                          hitSlop={8}
                          accessibilityRole="checkbox"
                          accessibilityLabel={`Mark set ${ri + 1} of ${name} done`}
                          accessibilityState={{ checked: row.done }}
                          style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: row.done ? T.brand : T.bgInputActive, borderWidth: 1, borderColor: row.done ? T.brand : T.line, alignItems: 'center', justifyContent: 'center' }}>
                          <Feather name="check" size={16} color={row.done ? T.onBrand : T.textDisabled} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                );
              })}
            </View>
          ))}

          {/* Session notes */}
          <Text style={{ color: T.textSub, fontSize: 13, marginBottom: 8 }}>Session notes (optional)</Text>
          <TextInput
            accessibilityLabel="Session notes"
            style={{ backgroundColor: T.bgInput, borderRadius: 16, borderWidth: 1, borderColor: T.line, color: T.text, padding: 14, fontSize: 14, height: 80, textAlignVertical: 'top', marginBottom: 14 }}
            value={notes} onChangeText={setNotes}
            placeholder="How did it feel? Any notes…" placeholderTextColor={T.textFaint}
            multiline
          />

          {/* Mood */}
          <Text style={{ color: T.textSub, fontSize: 13, marginBottom: 8 }}>Mood before (1–10, optional)</Text>
          <TextInput
            accessibilityLabel="Mood before, 1 to 10"
            style={{ backgroundColor: T.bgInput, borderRadius: 16, borderWidth: 1, borderColor: T.line, color: T.text, padding: 14, fontSize: 14, marginBottom: 20 }}
            value={mood} onChangeText={setMood}
            placeholder="e.g. 8" placeholderTextColor={T.textFaint}
            keyboardType="numeric"
          />
        </View>
      </ScrollView>

      {/* ── Sticky bottom CTA ── */}
      <View style={{ padding: 20, paddingBottom: Math.max(insets.bottom, 20), backgroundColor: T.bg, borderTopWidth: 1, borderTopColor: T.bgInput }}>
        <PrimaryButton label="Finish Workout" onPress={handleComplete} loading={isPending} disabled={exerciseCount === 0} />
      </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
