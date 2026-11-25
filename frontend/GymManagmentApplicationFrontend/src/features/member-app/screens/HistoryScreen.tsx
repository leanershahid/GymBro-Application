import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, R, withAlpha } from '../../../theme';
import { useWorkoutHistory } from '../../training/api/memberTrainingQueries';
import type { WorkoutHistoryItem } from '../../training/api/training.types';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import Skeleton from '../../common/components/Skeleton';
import EmptyState from '../../common/components/EmptyState';
import PrimaryButton from '../../common/components/PrimaryButton';
import { fmtMinutes, fmtVolume, groupHistoryByWeek, toDateString } from '../utils/planCalendar';

interface Props {
  onBack: () => void;
  onOpenLog: (logId: number) => void;
  onOpenRecords?: () => void;
}

/** Logged sessions grouped by week, with each week's volume and time. */
export default function HistoryScreen({ onBack, onOpenLog, onOpenRecords }: Props) {
  const q = useWorkoutHistory();
  const items = q.data?.pages.flatMap(p => p.items) ?? [];
  const weeks = groupHistoryByWeek(items, toDateString(new Date()));

  return (
    <Screen>
      <ScreenHeader eyebrow="Progress" title="Workout history" onBack={onBack}
        action={onOpenRecords ? { label: 'Records', icon: 'award', onPress: onOpenRecords } : undefined} />
      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
        {q.isLoading && <Skeleton rows={5} height={76} borderRadius={R.lg} gap={10} />}
        {q.isError && <EmptyState icon="wifi-off" tone="error" title="Couldn't load your history" action={{ label: 'Retry', onPress: () => q.refetch() }} />}
        {q.isSuccess && items.length === 0 && (
          <EmptyState icon="clock" title="No workouts logged yet" subtitle="Finish a workout and it shows up here with your sets and volume." />
        )}

        {weeks.map(w => (
          <View key={w.key} style={{ marginBottom: 18 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 8 }} accessibilityRole="header">
              <Text style={{ flex: 1, color: T.text, fontSize: 16, fontWeight: '800' }}>{w.label}</Text>
              <Text style={{ color: T.textSub, fontSize: 12 }}>
                {w.items.length} workout{w.items.length === 1 ? '' : 's'} · {fmtVolume(w.volumeKg)} · {fmtMinutes(w.minutes)}
              </Text>
            </View>
            {w.items.map(it => <HistoryRow key={it.logId} item={it} onPress={() => onOpenLog(it.logId)} />)}
          </View>
        ))}

        {q.hasNextPage && (
          <PrimaryButton label="Load more" variant="secondary" onPress={() => q.fetchNextPage()} loading={q.isFetchingNextPage} disabled={q.isFetchingNextPage} />
        )}
      </ScrollView>
    </Screen>
  );
}

const HistoryRow = React.memo(function HistoryRow({ item, onPress }: { item: WorkoutHistoryItem; onPress: () => void }) {
  const d = new Date(item.startedAt);
  const day = d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  const meta = [fmtMinutes(item.durationMin), `${item.sets} sets`, fmtVolume(item.volumeKg)].join(' · ');
  return (
    <Pressable onPress={onPress} accessibilityRole="button"
      accessibilityLabel={`${item.workoutName ?? 'Workout'}, ${day}. ${meta}${item.recordCount ? `, ${item.recordCount} personal records` : ''}`}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', minHeight: 68, padding: 14, marginBottom: 8, borderRadius: R.lg,
        backgroundColor: pressed ? T.bgInputActive : T.bgInput, borderWidth: 1, borderColor: T.line,
      })}>
      <View style={{ width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: T.brandDim, marginRight: 12 }}>
        <Text style={{ color: T.brand, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' }}>{d.toLocaleDateString(undefined, { weekday: 'short' })}</Text>
        <Text style={{ color: T.text, fontSize: 15, fontWeight: '800' }}>{d.getDate()}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: T.text, fontSize: 15, fontWeight: '700' }}>{item.workoutName ?? 'Workout'}</Text>
        <Text numberOfLines={1} style={{ color: T.textSub, fontSize: 12, marginTop: 2 }}>{meta}</Text>
      </View>
      {item.recordCount > 0 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: R.pill, backgroundColor: withAlpha(T.brandGold, 0.14), marginLeft: 8 }}>
          <Feather name="award" size={11} color={T.brandGold} />
          <Text style={{ color: T.brandGold, fontSize: 11, fontWeight: '800' }}>{item.recordCount}</Text>
        </View>
      )}
      <Feather name="chevron-right" size={16} color={T.textFaint} style={{ marginLeft: 6 }} />
    </Pressable>
  );
});
