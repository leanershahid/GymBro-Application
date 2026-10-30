import React, { useState } from 'react';
import { View, Text, FlatList, Pressable, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useWorkouts, useWorkout, useDeleteWorkout } from '../api/workoutQueries';
import { Workout } from '../types/workout.types';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import StatusPill from '../../common/components/StatusPill';
import { difficultyTone, goalTone } from '../../common/constants/statusColors';
import PaginationFooter from '../../common/components/PaginationFooter';
import Skeleton from '../../common/components/Skeleton';
import EmptyState from '../../dashboard/components/EmptyState';
import StatsStrip from '../../common/StatsStrip';
import DetailSheet, { fmtDate } from '../../exercises/components/DetailSheet';
import { humanize } from '../../exercises/components/ChipSelect';
import PrimaryButton from '../../common/components/PrimaryButton';
import { useToast } from '../../common/components/Toast';
import { apiErrorText } from '../../../api/apiError';
import { T, R, SP } from '../../../theme';

function WorkoutCard({ workout, onOpen }: { workout: Workout; onOpen: (id: number) => void }) {
  const goal  = workout.goal?.toLowerCase() ?? 'general';

  return (
    <Pressable
      onPress={() => onOpen(workout.id)}
      accessibilityRole="button"
      accessibilityHint="Opens workout details"
      accessibilityLabel={[
        workout.name, workout.category, workout.goal, workout.difficulty,
        workout.durationMin ? `${workout.durationMin} minutes` : null,
        workout.isPublic ? 'public' : null,
      ].filter(Boolean).join(', ')}
      style={({ pressed }) => ({
        backgroundColor: pressed ? T.bgInputActive : T.bgInput,
        borderRadius: R.xl, padding: 16, marginBottom: 12,
        borderWidth: 1, borderColor: T.bgInputActive,
      })}>
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
        {!!workout.goal && <StatusPill label={humanize(workout.goal)} tone={goalTone(goal)} />}
        {!!workout.difficulty && <StatusPill label={workout.difficulty} tone={difficultyTone(workout.difficulty)} />}
        {!!workout.durationMin && (
          <View style={{ backgroundColor: T.bgInputActive, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: T.line, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Feather name="clock" size={11} color={T.textFaint} />
            <Text style={{ color: T.textSub, fontSize: 11, fontWeight: '600' }}>{workout.durationMin}min</Text>
          </View>
        )}
        {workout.isPublic && <StatusPill label="Public" tone="brand" />}
      </View>
    </Pressable>
  );
}

interface Props {
  onBack?: () => void;
  onAddWorkout?: () => void;
  /** Override the built-in read-only detail sheet. */
  onOpenWorkout?: (id: number) => void;
}

export default function ViewWorkoutsPage({ onBack, onAddWorkout, onOpenWorkout }: Props) {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<number | null>(null);
  const { data: paged, isLoading, isError, refetch } = useWorkouts(page, 20);
  const detail = useWorkout(openId);
  const { mutate: del, isPending: deleting } = useDeleteWorkout();
  const w = detail.data;

  const handleOpen = (id: number) => (onOpenWorkout ? onOpenWorkout(id) : setOpenId(id));

  const handleDelete = (id: number, name: string) => {
    Alert.alert('Delete Workout', `Delete "${name}"? Members it is assigned to will lose it.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () =>
        del(id, {
          onSuccess: () => { setOpenId(null); toast.show({ type: 'success', message: 'Workout deleted.' }); },
          onError: (e) => Alert.alert('Delete failed', apiErrorText(e)),
        })
      },
    ]);
  };
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
        renderItem={({ item }) => <WorkoutCard workout={item} onOpen={handleOpen} />}
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

      <DetailSheet
        visible={openId !== null}
        onClose={() => setOpenId(null)}
        title={w?.name ?? 'Workout'}
        loading={detail.isLoading}
        error={detail.isError ? apiErrorText(detail.error) : null}
        rows={w ? [
          { label: 'Description', value: w.description },
          { label: 'Category',    value: w.category },
          { label: 'Goal',        value: w.goal ? humanize(w.goal) : null },
          { label: 'Difficulty',  value: w.difficulty },
          { label: 'Duration',    value: w.durationMin ? `${w.durationMin} min` : null },
          { label: 'Visibility',  value: w.isPublic ? 'Public' : 'Private' },
          { label: 'Tags',        value: w.tags?.join(', ') },
          { label: 'Created',     value: fmtDate(w.createdAt) },
        ] : []}
        footer={w ? (
          <PrimaryButton label="Delete workout" icon="trash-2" variant="danger" loading={deleting} onPress={() => handleDelete(w.id, w.name)} />
        ) : null}
      />
    </Screen>
  );
}
