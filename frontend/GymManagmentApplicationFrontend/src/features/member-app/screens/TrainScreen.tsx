import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useMyWorkouts, useExerciseList, useBookmarkWorkout } from '../api/memberAppQueries';
import { getDifficultyColor } from '../../common/constants/statusColors';
import { T, R, withAlpha } from '../../../theme';
import Screen from '../../common/components/Screen';
import Skeleton from '../../common/components/Skeleton';
import SegmentedTabs from '../../common/components/SegmentedTabs';
import SearchBar from '../../common/components/SearchBar';
import StatusPill from '../../common/components/StatusPill';
import PaginationFooter from '../../common/components/PaginationFooter';
import EmptyState from '../../dashboard/components/EmptyState';
import { difficultyTone, goalTone } from '../components/pillTones';

type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

const CAT_ICON: Record<string, FeatherIconName> = {
  strength: 'zap', cardio: 'activity', flexibility: 'wind', balance: 'target',
};
const EX_FILTERS = ['All', 'Strength', 'Cardio', 'Flexibility', 'Balance'];

interface Props { userId: number; onOpenWorkout: (id: number) => void; }

export default function TrainScreen({ userId, onOpenWorkout }: Props) {
  const [tab, setTab]           = useState<'workouts' | 'exercises'>('workouts');
  const [exPage, setExPage]     = useState(1);
  const [exFilter, setExFilter] = useState('All');
  const [search, setSearch]     = useState('');
  const [wPage, setWPage]       = useState(1);

  const { data: wPaged, isLoading: wLoad, isError: wErr, refetch: wRefetch } = useMyWorkouts(userId, wPage);
  const tagParam = exFilter !== 'All' ? exFilter.toLowerCase() : undefined;
  const { data: exPaged, isLoading: exLoad, isError: exErr, refetch: exRefetch } = useExerciseList(exPage, tagParam);
  const { mutate: bookmark } = useBookmarkWorkout();

  const workouts    = wPaged?.items      ?? [];
  const wTotal      = wPaged?.totalPages ?? 1;
  const exercises   = exPaged?.items     ?? [];
  const exTotal     = exPaged?.totalPages ?? 1;

  const filteredEx = search.trim()
    ? exercises.filter(e => e.name.toLowerCase().includes(search.toLowerCase()))
    : exercises;

  return (
    <Screen>

      {/* Header */}
      <View className="px-5 pt-5 pb-3">
        <Text className="text-sub text-[11px] font-semibold uppercase tracking-widest mb-1">Member</Text>
        <Text className="text-white text-[28px] font-extrabold tracking-tight mb-4">Train</Text>

        {/* Tab switcher */}
        <SegmentedTabs
          tabs={[{ key: 'workouts', label: 'Workouts' }, { key: 'exercises', label: 'Exercises' }]}
          value={tab}
          onChange={setTab}
        />
      </View>

      {/* ── Workouts tab ── */}
      {tab === 'workouts' && (
        <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
          {wLoad && <Skeleton rows={4} />}
          {wErr && (
            <EmptyState icon="wifi-off" tone="error" title="Failed to load" action={{ label: 'Retry', onPress: () => wRefetch() }} />
          )}
          {!wLoad && !wErr && workouts.length === 0 && (
            <EmptyState icon="activity" title="No workouts assigned" subtitle="Ask your trainer to assign a workout." />
          )}
          {!wLoad && !wErr && workouts.map(w => {
            return (
              <Pressable key={w.id} onPress={() => onOpenWorkout(w.id)}
                accessibilityRole="button"
                accessibilityLabel={`Open workout ${w.name}`}
                style={({ pressed }) => ({
                  backgroundColor: pressed ? T.bgInputActive : T.bgInput,
                  borderRadius: R.xl, padding: 16, marginBottom: 12,
                  borderWidth: 1, borderColor: pressed ? withAlpha(T.brand, 0.20) : T.bgInputActive,
                })}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text className="text-white text-[16px] font-bold" numberOfLines={1}>{w.name}</Text>
                    {!!w.description && <Text className="text-sub text-[12px] mt-1" numberOfLines={2}>{w.description}</Text>}
                  </View>
                  {/* Start button */}
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: T.brand, alignItems: 'center', justifyContent: 'center' }}>
                    <Feather name="play" size={15} color={T.onBrand} />
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                  {w.goal && <StatusPill label={w.goal} tone={goalTone(w.goal)} />}
                  {w.difficulty && <StatusPill label={w.difficulty} tone={difficultyTone(w.difficulty)} />}
                  {!!w.durationMin && <View style={{ backgroundColor: T.bgInputActive, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: T.line, flexDirection: 'row', alignItems: 'center', gap: 4 }}><Feather name="clock" size={10} color={T.textFaint} /><Text style={{ color: T.textSub, fontSize: 11 }}>{w.durationMin}min</Text></View>}
                </View>
                {/* Bookmark */}
                <Pressable onPress={() => bookmark(w.id, {
                  onSuccess: () => Alert.alert('✓', 'Bookmark toggled.'),
                  onError: () => {},
                })}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel={`Save ${w.name}`}
                  style={{ alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 32, paddingHorizontal: 4 }}>
                  <Feather name="bookmark" size={14} color={T.textSub} />
                  <Text style={{ color: T.textSub, fontSize: 12 }}>Save</Text>
                </Pressable>
              </Pressable>
            );
          })}
          {/* Pagination */}
          {!wLoad && !wErr && <PaginationFooter page={wPage} totalPages={wTotal} onChange={setWPage} />}
        </ScrollView>
      )}

      {/* ── Exercises tab ── */}
      {tab === 'exercises' && (
        <>
          <View className="px-5 pb-3">
            {/* Category filter chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 10 }}>
              {EX_FILTERS.map(f => {
                const active = f === exFilter;
                return (
                  <Pressable key={f} onPress={() => { setExFilter(f); setExPage(1); }}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={`Filter: ${f}`}
                    accessibilityState={{ selected: active }}
                    style={{ minHeight: 36, justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: active ? T.brand : T.bgInput, borderWidth: 1, borderColor: active ? T.brand : T.line }}>
                    <Text style={{ color: active ? T.onBrand : T.textSub, fontSize: 12, fontWeight: '700' }}>{f}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            {/* Search */}
            <SearchBar value={search} onChangeText={setSearch} placeholder="Search exercises…" label="Search exercises" />
          </View>

          <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
            {exLoad && <Skeleton rows={4} />}
            {exErr && (
              <EmptyState icon="wifi-off" tone="error" title="Failed to load exercises" action={{ label: 'Retry', onPress: () => exRefetch() }} />
            )}
            {!exLoad && !exErr && filteredEx.map(ex => {
              const diff  = ex.difficulty?.toLowerCase() ?? 'beginner';
              const cat   = ex.category?.toLowerCase()   ?? 'strength';
              const color = getDifficultyColor(diff);
              const icon  = CAT_ICON[cat]  ?? 'zap';
              return (
                <View key={ex.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: T.bgInput, borderRadius: 18, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: T.bgInputActive }}>
                  <View style={{ width: 60, height: 60, borderRadius: 12, backgroundColor: T.bgInputActive, borderWidth: 1, borderColor: T.line, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                    <Feather name={icon} size={26} color={color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text className="text-white text-[15px] font-bold" numberOfLines={1}>{ex.name}</Text>
                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                      {ex.category && <StatusPill label={ex.category} tone="neutral" />}
                      {ex.difficulty && <StatusPill label={ex.difficulty} tone={difficultyTone(ex.difficulty)} />}
                    </View>
                  </View>
                  <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: withAlpha(T.brand, 0.10), borderWidth: 1, borderColor: withAlpha(T.brand, 0.25), alignItems: 'center', justifyContent: 'center' }}>
                    <Feather name="play" size={14} color={T.brand} />
                  </View>
                </View>
              );
            })}
            {/* Ex Pagination */}
            {!exLoad && !exErr && <PaginationFooter page={exPage} totalPages={exTotal} onChange={setExPage} />}
          </ScrollView>
        </>
      )}
    </Screen>
  );
}
