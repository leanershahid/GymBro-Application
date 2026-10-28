import React, { useState } from 'react';
import { View, Text, FlatList } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useWorkouts } from '../api/workoutQueries';
import { Workout } from '../types/workout.types';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import StatusPill from '../../common/components/StatusPill';
import { difficultyTone, goalTone } from '../../common/constants/statusColors';
import PaginationFooter from '../../common/components/PaginationFooter';
import Skeleton from '../../common/components/Skeleton';
import EmptyState from '../../dashboard/components/EmptyState';
import StatsStrip from '../../common/StatsStrip';
import { T, R, SP } from '../../../theme';

// There is no workout detail screen yet, so the card is a grouped View rather than a
// Pressable with a no-op handler.
function WorkoutCard({ workout }: { workout: Workout }) {
  const goal  = workout.goal?.toLowerCase() ?? 'general';

  return (
    <View
      accessible
      accessibilityLabel={[
        workout.name, workout.category, workout.goal, workout.difficulty,
        workout.durationMin ? `${workout.durationMin} minutes` : null,
        workout.isPublic ? 'public' : null,
      ].filter(Boolean).join(', ')}
      style={{
        backgroundColor: T.bgInput,
        borderRadius: R.xl, padding: 16, marginBottom: 12,
        borderWidth: 1, borderColor: T.bgInputActive,
      }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <View style={{ flex: 1, minWidth: 0, paddingRight: 10 }}>
          <Text className="text-white text-[16px] font-bold" numberOfLines={1}>{workout.name}</Text>
          {!!workout.description && <Text className="text-sub text-[12px] mt-1" numberOfLines={2}>{workout.description}</Text>}
        </View>
        <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: T.brand, alignItems: 'center', justifyContent: 'center' }}>
          <Feather name="arrow-up-right" size={16} color={T.onBrand} />
        </View>
      </View>

      {/* Tags row */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {!!workout.category && <StatusPill label={workout.category} tone="neutral" />}
        {!!workout.goal && <StatusPill label={workout.goal} tone={goalTone(goal)} />}
        {!!workout.difficulty && <StatusPill label={workout.difficulty} tone={difficultyTone(workout.difficulty)} />}
        {!!workout.durationMin && (
          <View style={{ backgroundColor: T.bgInputActive, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: T.line, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Feather name="clock" size={11} color={T.textFaint} />
            <Text style={{ color: T.textSub, fontSize: 11, fontWeight: '600' }}>{workout.durationMin}min</Text>
          </View>
        )}
        {workout.isPublic && <StatusPill label="Public" tone="brand" />}
      </View>
    </View>
  );
}

interface Props { onBack?: () => void; onAddWorkout?: () => void; }

export default function ViewWorkoutsPage({ onBack, onAddWorkout }: Props) {
  const [page, setPage] = useState(1);
  const { data: paged, isLoading, isError, refetch } = useWorkouts(page, 20);
  const items      = paged?.items ?? [];
  const totalPages = paged?.totalPages ?? 1;
  const totalRecs  = paged?.totalRecords;

  return (
    <Screen>
      <ScreenHeader
        eyebrow="Training"
        title="Workouts"
        onBack={onBack}
        action={onAddWorkout ? { label: 'Add', icon: 'plus', onPress: onAddWorkout } : undefined}
      />

      {!isLoading && !isError && (
        <View style={{ paddingHorizontal: SP.xl, paddingBottom: SP.lg }}>
          <StatsStrip items={[
            { icon: 'activity', label: 'Total', value: totalRecs == null ? '—' : totalRecs.toLocaleString('en-IN'),      accent: T.brand },
            { icon: 'layers',   label: 'Page',  value: `${page}/${totalPages}`, accent: T.sky },
            { icon: 'eye',      label: 'On this page', value: String(items.length), accent: T.violet },
          ]} />
        </View>
      )}

      <FlatList
        data={isLoading || isError ? [] : items}
        keyExtractor={(w) => String(w.id)}
        renderItem={({ item }) => <WorkoutCard workout={item} />}
        ListHeaderComponent={
          isLoading ? <Skeleton rows={4} height={100} borderRadius={R.xl} gap={12} /> :
          isError ? (
            <EmptyState
              icon="wifi-off"
              tone="error"
              title="Failed to load"
              subtitle="Check your connection and try again."
              action={{ label: 'Retry', onPress: () => refetch() }}
            />
          ) : null
        }
        ListEmptyComponent={
          !isLoading && !isError ? <EmptyState icon="activity" title="No workouts yet" /> : null
        }
        ListFooterComponent={
          !isLoading && !isError
            ? <PaginationFooter page={page} totalPages={totalPages} onChange={setPage} />
            : null
        }
        contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}
