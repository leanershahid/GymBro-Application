import React, { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput,
  StatusBar, Platform, ActivityIndicator, Alert, ImageBackground,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useWorkoutDetail, useCompleteWorkout } from '../api/memberAppQueries';
import { WorkoutSetLog } from '../types/member-app.types';
import { getDifficultyColor } from '../../common/constants/statusColors';
import { T, withAlpha } from '../../../theme';

const IMG_HERO = require('../../../assets/dashboard/workout-1.jpg');

interface SetRowState { reps: string; weight: string; rpe: string; done: boolean; }

interface Props { workoutId: number; userId: number; onBack: () => void; }

export default function WorkoutDetailScreen({ workoutId, userId, onBack }: Props) {
  const { data: workout, isLoading, isError, refetch } = useWorkoutDetail(workoutId);
  const { mutate: complete, isPending } = useCompleteWorkout();

  // set logs — keyed by exerciseId
  const [sets, setSets] = useState<Record<number, SetRowState[]>>({});
  const [notes, setNotes]   = useState('');
  const [mood, setMood]     = useState('');
  const [started] = useState(new Date().toISOString());

  const ensureSets = (exId: number, count: number) => {
    if (!sets[exId]) {
      setSets(prev => ({
        ...prev,
        [exId]: Array.from({ length: count }, () => ({ reps: '', weight: '', rpe: '', done: false })),
      }));
    }
  };

  const updateSet = (exId: number, idx: number, field: keyof SetRowState, val: string | boolean) => {
    setSets(prev => {
      const rows = [...(prev[exId] ?? [])];
      rows[idx] = { ...rows[idx], [field]: val };
      return { ...prev, [exId]: rows };
    });
  };

  const handleComplete = () => {
    if (!workout) return;

    const allSets: WorkoutSetLog[] = [];
    workout.exercises.forEach(ex => {
      const rows = sets[ex.exerciseId] ?? [];
      rows.forEach((r, i) => {
        if (r.done && r.reps) {
          allSets.push({
            exerciseId: ex.exerciseId,
            setNo:      i + 1,
            reps:       Number(r.reps)   || 0,
            weightKg:   Number(r.weight) || 0,
            rpe:        r.rpe ? Number(r.rpe) : undefined,
          });
        }
      });
    });

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
      onSuccess: res => Alert.alert(res.success ? 'Workout logged! 🎉' : 'Error', res.message ?? ''),
      onError:   () => Alert.alert('Error', 'Failed to log workout.'),
    });
  };

  if (isLoading) return (
    <View className="flex-1 bg-bg items-center justify-center">
      <ActivityIndicator size="large" color={T.brand} />
    </View>
  );

  if (isError || !workout) return (
    <View className="flex-1 bg-bg items-center justify-center px-8">
      <Feather name="wifi-off" size={32} color={T.err} />
      <Text className="text-white text-[16px] font-bold mt-4 mb-6">Failed to load</Text>
      <Pressable onPress={() => refetch()} className="bg-brand rounded-full px-8 py-3">
        <Text className="text-black font-bold">Retry</Text>
      </Pressable>
    </View>
  );

  const diff  = workout.difficulty?.toLowerCase() ?? 'beginner';
  const dc    = getDifficultyColor(diff);

  return (
    <View className="flex-1 bg-bg" style={{ paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0 }}>
      <StatusBar barStyle="light-content" backgroundColor={T.bg} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

        {/* ── Hero image — top half ── */}
        <View style={{ height: 240, position: 'relative' }}>
          <ImageBackground source={IMG_HERO} style={{ flex: 1 }} resizeMode="cover">
            <View style={{ flex: 1, backgroundColor: T.overlay }}>
              {/* Back button */}
              <Pressable onPress={onBack} hitSlop={12}
                style={{ position: 'absolute', top: 16, left: 20, width: 36, height: 36, borderRadius: 18, backgroundColor: T.overlay, borderWidth: 1, borderColor: withAlpha(T.text, 0.22), alignItems: 'center', justifyContent: 'center' }}>
                <Feather name="arrow-left" size={18} color={T.text} />
              </Pressable>

              {/* Floating timer pill — sits at bottom of hero */}
              <View style={{ position: 'absolute', bottom: 16, alignSelf: 'center', backgroundColor: T.overlay, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: withAlpha(T.text, 0.18) }}>
                <Feather name="clock" size={14} color={T.brand} />
                <Text style={{ color: T.text, fontSize: 13, fontWeight: '600' }}>
                  {workout.durationMin ? `~${workout.durationMin} min` : 'Custom duration'}
                </Text>
                <View style={{ width: 1, height: 12, backgroundColor: withAlpha(T.text, 0.25) }} />
                <View style={{ backgroundColor: dc + '20', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: dc + '40' }}>
                  <Text style={{ color: dc, fontSize: 11, fontWeight: '700' }}>{workout.difficulty ?? 'Beginner'}</Text>
                </View>
              </View>
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

        {/* ── Exercise list ── */}
        <View style={{ paddingHorizontal: 20 }}>
          <Text style={{ color: T.text, fontSize: 17, fontWeight: '700', marginBottom: 14 }}>
            Exercises ({workout.exercises.length})
          </Text>

          {workout.exercises.map((ex, ei) => {
            ensureSets(ex.exerciseId, ex.sets);
            const rows = sets[ex.exerciseId] ?? Array.from({ length: ex.sets }, () => ({ reps: '', weight: '', rpe: '', done: false }));
            return (
              <View key={ex.exerciseId} style={{ backgroundColor: T.bgInput, borderRadius: 20, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: T.bgInputActive }}>
                {/* Exercise header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                  <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: T.bgInputActive, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    <Text style={{ color: T.brand, fontSize: 13, fontWeight: '900' }}>{ei + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: T.text, fontSize: 15, fontWeight: '700' }}>{ex.name}</Text>
                    <Text style={{ color: T.textSub, fontSize: 12, marginTop: 2 }}>
                      {ex.sets} sets × {ex.reps} reps · {ex.restSec}s rest
                    </Text>
                  </View>
                </View>

                {/* Column headers */}
                <View style={{ flexDirection: 'row', marginBottom: 8 }}>
                  <Text style={{ width: 36, color: T.textFaint, fontSize: 11, fontWeight: '600' }}>SET</Text>
                  <Text style={{ flex: 1, color: T.textFaint, fontSize: 11, fontWeight: '600', textAlign: 'center' }}>REPS</Text>
                  <Text style={{ flex: 1, color: T.textFaint, fontSize: 11, fontWeight: '600', textAlign: 'center' }}>KG</Text>
                  <Text style={{ flex: 1, color: T.textFaint, fontSize: 11, fontWeight: '600', textAlign: 'center' }}>RPE</Text>
                  <Text style={{ width: 36, color: T.textFaint, fontSize: 11, fontWeight: '600', textAlign: 'center' }}>✓</Text>
                </View>

                {/* Set rows */}
                {rows.map((row, ri) => (
                  <View key={ri} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={{ width: 36, color: T.textSub, fontSize: 12, fontWeight: '700' }}>{ri + 1}</Text>
                    {(['reps', 'weight', 'rpe'] as const).map(field => (
                      <TextInput key={field}
                        style={{ flex: 1, backgroundColor: T.bgInputActive, borderRadius: 10, height: 36, textAlign: 'center', color: row.done ? T.brand : T.text, fontSize: 13, fontWeight: '600', marginHorizontal: 3, borderWidth: 1, borderColor: row.done ? withAlpha(T.brand, 0.30) : T.line }}
                        value={row[field]}
                        onChangeText={v => updateSet(ex.exerciseId, ri, field, v)}
                        keyboardType="numeric"
                        placeholder={field === 'rpe' ? '—' : '0'}
                        placeholderTextColor={T.textDisabled}
                        editable={!row.done}
                      />
                    ))}
                    <Pressable onPress={() => updateSet(ex.exerciseId, ri, 'done', !row.done)}
                      style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: row.done ? T.brand : T.bgInputActive, borderWidth: 1, borderColor: row.done ? T.brand : T.line, alignItems: 'center', justifyContent: 'center' }}>
                      <Feather name="check" size={16} color={row.done ? T.onBrand : T.textDisabled} />
                    </Pressable>
                  </View>
                ))}
              </View>
            );
          })}

          {/* Session notes */}
          <Text style={{ color: T.textSub, fontSize: 13, marginBottom: 8 }}>Session notes (optional)</Text>
          <TextInput
            style={{ backgroundColor: T.bgInput, borderRadius: 16, borderWidth: 1, borderColor: T.line, color: T.text, padding: 14, fontSize: 14, height: 80, textAlignVertical: 'top', marginBottom: 14 }}
            value={notes} onChangeText={setNotes}
            placeholder="How did it feel? Any notes…" placeholderTextColor={T.textFaint}
            multiline
          />

          {/* Mood */}
          <Text style={{ color: T.textSub, fontSize: 13, marginBottom: 8 }}>Mood before (1–10, optional)</Text>
          <TextInput
            style={{ backgroundColor: T.bgInput, borderRadius: 16, borderWidth: 1, borderColor: T.line, color: T.text, padding: 14, fontSize: 14, marginBottom: 20 }}
            value={mood} onChangeText={setMood}
            placeholder="e.g. 8" placeholderTextColor={T.textFaint}
            keyboardType="numeric"
          />
        </View>
      </ScrollView>

      {/* ── Sticky bottom CTA ── */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, paddingBottom: Platform.OS === 'ios' ? 34 : 20, backgroundColor: T.bg, borderTopWidth: 1, borderTopColor: T.bgInput }}>
        <Pressable onPress={handleComplete} disabled={isPending}
          style={{ height: 56, borderRadius: 999, backgroundColor: isPending ? T.brandDark : T.brand, alignItems: 'center', justifyContent: 'center' }}>
          {isPending
            ? <ActivityIndicator color={T.onBrand} />
            : <Text style={{ color: T.onBrand, fontSize: 16, fontWeight: '700' }}>Finish Workout</Text>
          }
        </Pressable>
      </View>
    </View>
  );
}
