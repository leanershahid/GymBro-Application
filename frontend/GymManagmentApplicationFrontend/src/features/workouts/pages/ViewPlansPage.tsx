import React, { useState } from 'react';
import {
  View, Text, ScrollView, Pressable,
  StatusBar, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { usePlans } from '../api/workoutQueries';
import { WorkoutPlan } from '../types/workout.types';
import BackButton from '../../common/components/BackButton';
import PaginationFooter from '../../common/components/PaginationFooter';
import Skeleton from '../../common/components/Skeleton';
import { getDifficultyColor } from '../../common/constants/statusColors';

const GOAL_COLOR: Record<string, string> = {
  general: '#AAAAAA', weightloss: '#22D3EE', musclegain: '#7ED321', endurance: '#FACC15',
};

function PlanCard({ plan, onPress }: { plan: WorkoutPlan; onPress: () => void }) {
  const goal  = plan.goal?.toLowerCase() ?? 'general';
  const diff  = plan.difficulty?.toLowerCase() ?? 'beginner';
  const gc    = GOAL_COLOR[goal] ?? '#AAAAAA';
  const dc    = getDifficultyColor(diff);

  return (
    <Pressable onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: pressed ? '#1C211C' : '#151915',
        borderRadius: 20, padding: 16, marginBottom: 12,
        borderWidth: 1, borderColor: pressed ? 'rgba(126,211,33,0.20)' : '#1C211C',
      })}>
      {/* Accent bar */}
      <View style={{ height: 3, backgroundColor: gc, borderRadius: 2, marginBottom: 14, width: 40 }} />

      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text className="text-white text-[16px] font-bold" numberOfLines={1}>{plan.name}</Text>
          {!!plan.description && <Text className="text-sub text-[12px] mt-1" numberOfLines={2}>{plan.description}</Text>}
        </View>
        {/* Duration badge */}
        <View style={{ backgroundColor: 'rgba(126,211,33,0.10)', borderWidth: 1, borderColor: 'rgba(126,211,33,0.25)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center' }}>
          <Text style={{ color: '#7ED321', fontSize: 18, fontWeight: '900' }}>{plan.durationWeeks}</Text>
          <Text style={{ color: '#AAAAAA', fontSize: 9, fontWeight: '600' }}>WKS</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {plan.goal && (
          <View style={{ backgroundColor: gc + '15', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: gc + '35' }}>
            <Text style={{ color: gc, fontSize: 10, fontWeight: '700' }}>{plan.goal}</Text>
          </View>
        )}
        {plan.difficulty && (
          <View style={{ backgroundColor: dc + '15', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: dc + '35' }}>
            <Text style={{ color: dc, fontSize: 10, fontWeight: '700' }}>{plan.difficulty}</Text>
          </View>
        )}
        <View style={{ backgroundColor: plan.isActive ? 'rgba(126,211,33,0.10)' : '#1C211C', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: plan.isActive ? 'rgba(126,211,33,0.25)' : '#242B24' }}>
          <Text style={{ color: plan.isActive ? '#7ED321' : '#555', fontSize: 10, fontWeight: '600' }}>
            {plan.isActive ? 'Active' : 'Inactive'}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

interface Props { onBack?: () => void; onAddPlan?: () => void; }

export default function ViewPlansPage({ onBack, onAddPlan }: Props) {
  const [page, setPage] = useState(1);
  const { data: paged, isLoading, isError, refetch } = usePlans(page, 20);
  const items      = paged?.items ?? [];
  const totalPages = paged?.totalPages ?? 1;
  const totalRecs  = paged?.totalRecords ?? 0;

  return (
    <View className="flex-1 bg-bg" style={{ paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0 }}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0F0A" />

      <View className="px-5 pt-5 pb-4">
        <View className="flex-row items-center justify-between mb-5">
          {onBack && <BackButton onPress={onBack} />}
          <View style={{ flex: 1 }}>
            <Text className="text-sub text-[11px] font-semibold uppercase tracking-widest mb-0.5">Programs</Text>
            <Text className="text-white text-[26px] font-extrabold tracking-tight">Workout Plans</Text>
          </View>
          {onAddPlan && (
            <Pressable onPress={onAddPlan} className="flex-row items-center gap-2 bg-brand rounded-full px-4 py-2.5">
              <Feather name="plus" size={15} color="#000" />
              <Text className="text-black text-[13px] font-bold">Add</Text>
            </Pressable>
          )}
        </View>

        {!isLoading && !isError && (
          <View className="flex-row gap-3 mb-2">
            {[{ l:'Total', v: totalRecs }, { l:'Active', v: items.filter(p => p.isActive).length }, { l:'Page', v: `${page}/${totalPages}` }].map(s => (
              <View key={s.l} className="flex-1 bg-surface border border-line rounded-2xl p-3 items-center gap-1">
                <Text className="text-brand text-[18px] font-extrabold">{s.v}</Text>
                <Text className="text-sub text-[10px] font-semibold">{s.l}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
        {isLoading && <Skeleton rows={4} height={110} borderRadius={20} gap={12} />}
        {isError && (
          <View className="items-center pt-16">
            <Feather name="wifi-off" size={28} color="#EF4444" />
            <Text className="text-white font-bold mt-4 mb-4">Failed to load</Text>
            <Pressable onPress={() => refetch()} className="bg-brand rounded-full px-7 py-3">
              <Text className="text-black font-bold">Retry</Text>
            </Pressable>
          </View>
        )}
        {!isLoading && !isError && items.length === 0 && (
          <View className="items-center pt-16">
            <View className="w-[68px] h-[68px] rounded-full bg-surface border border-line items-center justify-center mb-4">
              <Feather name="book-open" size={28} color="#AAA" />
            </View>
            <Text className="text-white text-[16px] font-bold">No plans yet</Text>
          </View>
        )}
        {!isLoading && !isError && items.map(p => <PlanCard key={p.id} plan={p} onPress={() => {}} />)}
        {!isLoading && !isError && <PaginationFooter page={page} totalPages={totalPages} onChange={setPage} />}
      </ScrollView>
    </View>
  );
}
