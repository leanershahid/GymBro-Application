import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useMyWorkouts, useExerciseList, useBookmarkWorkout, useMyTraining } from '../api/memberAppQueries';
import { useIsBookmarked } from '../api/bookmarkStore';
import { apiErrorText } from '../../../api/apiError';
import { useToast } from '../../common/components/Toast';
import { PlanTodayCard, AssignedWorkoutCard } from '../components/TrainingCards';
import { activeTodayPlans, sortOpenWorkouts, isOpen } from '../components/trainingUtils';
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
import { usePageTabs } from '../../access/context/AccessContext';

type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

const CAT_ICON: Record<string, FeatherIconName> = {
  strength: 'zap', cardio: 'activity', flexibility: 'wind', balance: 'target',
};
// NOTE: static filter options sent as the `tag` query param. No tag/category list endpoint is
// used here yet — if the API exposes one, build these chips from it instead.
const EX_FILTERS = ['All', 'Strength', 'Cardio', 'Flexibility', 'Balance'];

interface Props { userId: number; onOpenWorkout: (id: number) => void; }

export default function TrainScreen({ userId, onOpenWorkout }: Props) {
  // Tabs come from the access list (member.train.*); each one's data loads only when granted.
  const { items: tabs, tab, setTab, has } = usePageTabs('member.train');
  const [exPage, setExPage]     = useState(1);
  const [exFilter, setExFilter] = useState('All');
  const [search, setSearch]     = useState('');
  const [wPage, setWPage]       = useState(1);

  const { data: wPaged, isLoading: wLoad, isError: wErr, refetch: wRefetch } = useMyWorkouts(userId, wPage, has('workouts'));
  const tagParam = exFilter !== 'All' ? exFilter.toLowerCase() : undefined;
  const { data: exPaged, isLoading: exLoad, isError: exErr, refetch: exRefetch } = useExerciseList(exPage, tagParam, has('exercises'));

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
        {tabs.length > 1 && <SegmentedTabs tabs={tabs} value={tab ?? ''} onChange={setTab} />}
      </View>

      {/* ── Workouts tab ── */}
      {tab === 'workouts' && (
        <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
          <AssignedSection userId={userId} onOpenWorkout={onOpenWorkout} />

          <Text style={{ color: T.text, fontSize: 17, fontWeight: '700', marginBottom: 12 }}>Workout library</Text>
          {wLoad && <Skeleton rows={4} />}
          {wErr && (
            <EmptyState icon="wifi-off" tone="error" title="Failed to load" action={{ label: 'Retry', onPress: () => wRefetch() }} />
          )}
          {!wLoad && !wErr && workouts.length === 0 && (
            <EmptyState icon="activity" title="No workouts in the library" subtitle="Ask your trainer to add or assign a workout." />
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
                <BookmarkButton workoutId={w.id} name={w.name} />
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
              // Icon/tint are decoration only; neutral when the API has no category/difficulty.
              const color = ex.difficulty ? getDifficultyColor(ex.difficulty.toLowerCase()) : T.textSub;
              const icon  = (ex.category && CAT_ICON[ex.category.toLowerCase()]) || 'activity';
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

/** Toggle with filled/unfilled state; errors are toasted, not swallowed. */
function BookmarkButton({ workoutId, name }: { workoutId: number; name: string }) {
  const saved = useIsBookmarked(workoutId);
  const toast = useToast();
  const { mutate, isPending } = useBookmarkWorkout();
  const onPress = () => mutate(workoutId, {
    onSuccess: now => toast.show({ type: 'success', message: now ? `Saved ${name}.` : `Removed ${name} from saved.` }),
    onError: e => toast.show({ type: 'error', message: apiErrorText(e) }),
  });
  return (
    <Pressable onPress={onPress} disabled={isPending}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={saved ? `Remove ${name} from saved` : `Save ${name}`}
      accessibilityState={{ selected: saved, busy: isPending }}
      style={{ alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 32, paddingHorizontal: 4, opacity: isPending ? 0.6 : 1 }}>
      <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={14} color={saved ? T.brand : T.textSub} />
      <Text style={{ color: saved ? T.brand : T.textSub, fontSize: 12 }}>{saved ? 'Saved' : 'Save'}</Text>
    </Pressable>
  );
}

const ASSIGNED_PREVIEW = 3;

/** "Assigned to you": today's plan cards, then open assigned workouts (soonest due first). */
function AssignedSection({ userId, onOpenWorkout }: { userId: number; onOpenWorkout: (id: number) => void }) {
  const { data, isLoading, isError, refetch } = useMyTraining(userId);
  const [showAll, setShowAll] = useState(false);

  if (isLoading) return <View style={{ marginBottom: 20 }}><Skeleton rows={2} height={72} borderRadius={R.xl} gap={10} /></View>;
  if (isError) return (
    <View style={{ marginBottom: 20 }}>
      <EmptyState icon="wifi-off" tone="error" title="Couldn't load your assignments" action={{ label: 'Retry', onPress: () => refetch() }} />
    </View>
  );

  const todays = activeTodayPlans(data?.plans ?? []);
  const open = sortOpenWorkouts(data?.workouts ?? []);
  const done = (data?.workouts ?? []).filter(w => !isOpen(w.status));
  const list = showAll ? [...open, ...done] : open.slice(0, ASSIGNED_PREVIEW);
  const hidden = open.length + done.length - list.length;
  if (todays.length === 0 && open.length === 0 && done.length === 0) return null;

  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={{ color: T.text, fontSize: 17, fontWeight: '700', marginBottom: 12 }}>Assigned to you</Text>
      {todays.map(p => <PlanTodayCard key={p.assignmentId} plan={p} onOpenWorkout={onOpenWorkout} />)}
      {list.map(w => <AssignedWorkoutCard key={w.assignmentId} item={w} onOpenWorkout={onOpenWorkout} />)}
      {open.length === 0 && !showAll && done.length > 0 && (
        <Text style={{ color: T.textSub, fontSize: 13, marginBottom: 8 }}>You're all caught up on assigned workouts.</Text>
      )}
      {(hidden > 0 || showAll) && (
        <Pressable onPress={() => setShowAll(v => !v)} hitSlop={8} accessibilityRole="button"
          style={{ alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center' }}>
          <Text style={{ color: T.brand, fontSize: 13, fontWeight: '700' }}>
            {showAll ? 'Show less' : `Show all (${hidden} more${done.length ? ', incl. completed' : ''})`}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
