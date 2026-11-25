import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, R, withAlpha } from '../../../theme';
import { useMyTraining, useHealthToday } from '../api/memberAppQueries';
import MetricBar from '../components/MetricBar';
import EmptyState from '../../common/components/EmptyState';
import Screen from '../../common/components/Screen';
import Skeleton from '../../common/components/Skeleton';
import { AssignedPlanCard } from '../components/TrainingCards';

interface Props {
  userId: number;
  /** Optional: makes plan cards open the Plans screen. */
  onOpenPlans?: () => void;
  onOpenHistory?: () => void;
  onOpenRecords?: () => void;
}

export default function ProgressScreen({ userId, onOpenPlans, onOpenHistory, onOpenRecords }: Props) {
  const healthQ   = useHealthToday(userId);
  const trainingQ = useMyTraining(userId);
  const health = healthQ.data;
  const plans  = trainingQ.data?.plans ?? [];

  return (
    <Screen>
      <View className="px-5 pt-5 pb-3">
        <Text style={{ color: T.textSub, fontSize: 11, fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 2 }}>Today</Text>
        <Text style={{ color: T.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 }}>Progress</Text>
      </View>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
        {healthQ.isLoading ? (
          <View style={{ marginBottom: 24 }}><Skeleton rows={1} height={120} borderRadius={20} gap={0} /></View>
        ) : healthQ.isError || !health ? (
          <View style={{ marginBottom: 24 }}>
            <EmptyState icon="wifi-off" tone="error" title="Couldn't load today's activity"
              action={{ label: 'Retry', onPress: () => healthQ.refetch() }} />
          </View>
        ) : (
          <View style={{ backgroundColor: T.bgInput, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: T.line, marginBottom: 24 }}>
            <MetricBar label="Training minutes today" current={health.rings.train.current} goal={health.rings.train.goal} unit="min" color={T.brand} />
            <MetricBar label="Current streak" current={health.streakDays} goal={null} unit="days" color={T.brandGold} />
          </View>
        )}

        {(onOpenHistory || onOpenRecords) && (
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
            {onOpenHistory && <EntryCard icon="clock" tint={T.brand} title="Workout history" sub="Sessions, sets & volume" onPress={onOpenHistory} />}
            {onOpenRecords && <EntryCard icon="award" tint={T.brandGold} title="Personal records" sub="Your best lifts" onPress={onOpenRecords} />}
          </View>
        )}

        <Text style={{ color: T.text, fontSize: 16, fontWeight: '700', marginBottom: 14 }}>My plans</Text>
        {trainingQ.isLoading ? (
          <Skeleton rows={2} height={120} borderRadius={R.xl} gap={12} />
        ) : trainingQ.isError ? (
          <EmptyState icon="wifi-off" tone="error" title="Couldn't load plans" action={{ label: 'Retry', onPress: () => trainingQ.refetch() }} />
        ) : plans.length === 0 ? (
          <EmptyState icon="book-open" title="No plans assigned yet" subtitle="Your trainer will assign a plan to help you reach your goals." />
        ) : (
          plans.map(p => <AssignedPlanCard key={p.assignmentId} plan={p} onPress={onOpenPlans} />)
        )}
      </ScrollView>
    </Screen>
  );
}

function EntryCard({ icon, tint, title, sub, onPress }: {
  icon: React.ComponentProps<typeof Feather>['name']; tint: string; title: string; sub: string; onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${title}. ${sub}`}
      style={({ pressed }) => ({
        flex: 1, minHeight: 112, borderRadius: R.xl, padding: 14, justifyContent: 'space-between',
        backgroundColor: pressed ? T.bgInputActive : T.bgInput, borderWidth: 1, borderColor: T.line,
      })}>
      <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: withAlpha(tint, 0.14) }}>
        <Feather name={icon} size={17} color={tint} />
      </View>
      <View>
        <Text style={{ color: T.text, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>{title}</Text>
        <Text style={{ color: T.textSub, fontSize: 12, marginTop: 2 }} numberOfLines={1}>{sub}</Text>
      </View>
    </Pressable>
  );
}
