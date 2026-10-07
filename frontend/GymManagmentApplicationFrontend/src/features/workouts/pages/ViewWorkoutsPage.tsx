import React, { useState } from 'react';
import {
  View, Text, ScrollView, Pressable,
  StatusBar, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useWorkouts } from '../api/workoutQueries';
import { Workout } from '../types/workout.types';
import BackButton from '../../common/components/BackButton';
import PaginationFooter from '../../common/components/PaginationFooter';
import Skeleton from '../../common/components/Skeleton';
import { getDifficultyColor } from '../../common/constants/statusColors';
import { T, withAlpha } from '../../../theme';

const GOAL_COLOR: Record<string, string> = {
  general:    T.textSub,
  weightloss: T.sky,
  musclegain: T.brand,
  endurance:  T.brandGold,
};

function WorkoutCard({ workout, onPress }: { workout: Workout; onPress: () => void }) {
  const goal  = workout.goal?.toLowerCase()       ?? 'general';
  const diff  = workout.difficulty?.toLowerCase() ?? 'beginner';
  const gc    = GOAL_COLOR[goal]  ?? T.textSub;
  const dc    = getDifficultyColor(diff);

  return (
    <Pressable onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: pressed ? T.bgInputActive : T.bgInput,
        borderRadius: 20, padding: 16, marginBottom: 12,
        borderWidth: 1, borderColor: pressed ? withAlpha(T.brand, 0.20) : T.bgInputActive,
      })}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text className="text-white text-[16px] font-bold" numberOfLines={1}>{workout.name}</Text>
          {!!workout.description && <Text className="text-sub text-[12px] mt-1" numberOfLines={2}>{workout.description}</Text>}
        </View>
        <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: T.brand, alignItems: 'center', justifyContent: 'center' }}>
          <Feather name="arrow-up-right" size={16} color={T.onBrand} />
        </View>
      </View>

      {/* Tags row */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {workout.category && (
          <View style={{ backgroundColor: T.bgInputActive, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: T.line }}>
            <Text style={{ color: T.textSub, fontSize: 10, fontWeight: '600' }}>{workout.category}</Text>
          </View>
        )}
        {workout.goal && (
          <View style={{ backgroundColor: gc + '15', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: gc + '35' }}>
            <Text style={{ color: gc, fontSize: 10, fontWeight: '700' }}>{workout.goal}</Text>
          </View>
        )}
        {workout.difficulty && (
          <View style={{ backgroundColor: dc + '15', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: dc + '35' }}>
            <Text style={{ color: dc, fontSize: 10, fontWeight: '700' }}>{workout.difficulty}</Text>
          </View>
        )}
        {workout.durationMin && (
          <View style={{ backgroundColor: T.bgInputActive, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: T.line, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Feather name="clock" size={10} color={T.textFaint} />
            <Text style={{ color: T.textSub, fontSize: 10, fontWeight: '600' }}>{workout.durationMin}min</Text>
          </View>
        )}
        {workout.isPublic && (
          <View style={{ backgroundColor: withAlpha(T.brand, 0.10), borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: withAlpha(T.brand, 0.25) }}>
            <Text style={{ color: T.brand, fontSize: 10, fontWeight: '600' }}>Public</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

interface Props { onBack?: () => void; onAddWorkout?: () => void; }

export default function ViewWorkoutsPage({ onBack, onAddWorkout }: Props) {
  const [page, setPage] = useState(1);
  const { data: paged, isLoading, isError, refetch } = useWorkouts(page, 20);
  const items      = paged?.items ?? [];
  const totalPages = paged?.totalPages ?? 1;
  const totalRecs  = paged?.totalRecords ?? 0;

  return (
    <View className="flex-1 bg-bg" style={{ paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0 }}>
      <StatusBar barStyle="light-content" backgroundColor={T.bg} />

      <View className="px-5 pt-5 pb-4">
        <View className="flex-row items-center justify-between mb-5">
          {onBack && <BackButton onPress={onBack} />}
          <View style={{ flex: 1 }}>
            <Text className="text-sub text-[11px] font-semibold uppercase tracking-widest mb-0.5">Training</Text>
            <Text className="text-white text-[26px] font-extrabold tracking-tight">Workouts</Text>
          </View>
          {onAddWorkout && (
            <Pressable onPress={onAddWorkout} className="flex-row items-center gap-2 bg-brand rounded-full px-4 py-2.5">
              <Feather name="plus" size={15} color={T.onBrand} />
              <Text className="text-black text-[13px] font-bold">Add</Text>
            </Pressable>
          )}
        </View>

        {!isLoading && !isError && (
          <View className="flex-row gap-3 mb-2">
            {[{ l:'Total', v: totalRecs }, { l:'Page', v:`${page}/${totalPages}` }, { l:'Shown', v: items.length }].map(s => (
              <View key={s.l} className="flex-1 bg-surface border border-line rounded-2xl p-3 items-center gap-1">
                <Text className="text-brand text-[18px] font-extrabold">{s.v}</Text>
                <Text className="text-sub text-[10px] font-semibold">{s.l}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
        {isLoading && <Skeleton rows={4} height={100} borderRadius={20} gap={12} />}
        {isError && (
          <View className="items-center pt-16">
            <Feather name="wifi-off" size={28} color={T.err} />
            <Text className="text-white text-[16px] font-bold mt-4 mb-4">Failed to load</Text>
            <Pressable onPress={() => refetch()} className="bg-brand rounded-full px-7 py-3">
              <Text className="text-black font-bold">Retry</Text>
            </Pressable>
          </View>
        )}
        {!isLoading && !isError && items.length === 0 && (
          <View className="items-center pt-16">
            <View className="w-[68px] h-[68px] rounded-full bg-surface border border-line items-center justify-center mb-4">
              <Feather name="activity" size={28} color={T.textSub} />
            </View>
            <Text className="text-white text-[16px] font-bold">No workouts yet</Text>
          </View>
        )}
        {!isLoading && !isError && items.map(w => <WorkoutCard key={w.id} workout={w} onPress={() => {}} />)}
        {!isLoading && !isError && <PaginationFooter page={page} totalPages={totalPages} onChange={setPage} />}
      </ScrollView>
    </View>
  );
}
