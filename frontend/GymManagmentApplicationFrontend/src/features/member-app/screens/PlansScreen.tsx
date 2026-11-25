import React, { useState } from 'react';
import { ScrollView } from 'react-native';
import { useMyTraining } from '../api/memberAppQueries';
import { R } from '../../../theme';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import Skeleton from '../../common/components/Skeleton';
import EmptyState from '../../common/components/EmptyState';
import { AssignedPlanCard } from '../components/TrainingCards';
import PlanWeekScreen from './PlanWeekScreen';
import type { WorkoutContext } from '../memberRoutes';

interface Props {
  onBack?: () => void;
  /** Optional: scopes the cached /me/training data to the signed-in user. */
  userId?: number;
  /** Opens a plan day's workout (from the inline week view of `plans/{id}`). */
  onOpenWorkout: (id: number, ctx: WorkoutContext) => void;
  /** Opens a plan's week view (plan-week/{assignmentId}). */
  onOpenPlan: (assignmentId: number) => void;
  /** `plans/{id}` (older links): an assignment id or a plan id; shows that plan's week view. */
  initialPlanId?: number;
}

/** The member's assigned plans (GET /me/training); tap one for its week-by-week schedule. */
export default function PlansScreen({ onBack, userId, onOpenWorkout, onOpenPlan, initialPlanId }: Props) {
  const { data, isLoading, isError, refetch } = useMyTraining(userId);
  const [selectedId, setSelectedId] = useState<number | null>(initialPlanId ?? null);
  const plans = data?.plans ?? [];
  const selected = plans.find(p => p.assignmentId === selectedId) ?? plans.find(p => p.planId === selectedId);

  if (selected && userId) {
    return (
      <PlanWeekScreen assignmentId={selected.assignmentId} userId={userId}
        onBack={() => setSelectedId(null)} onOpenWorkout={onOpenWorkout} />
    );
  }

  return (
    <Screen>
      <ScreenHeader eyebrow="My Programs" title="Training Plans" onBack={onBack} />

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
        {isLoading && <Skeleton rows={3} height={130} borderRadius={R.xl} gap={12} />}

        {isError && (
          <EmptyState icon="wifi-off" tone="error" title="Failed to load plans" action={{ label: 'Retry', onPress: () => refetch() }} />
        )}

        {!isLoading && !isError && plans.length === 0 && (
          <EmptyState icon="book-open" title="No plans assigned yet" subtitle="Your trainer will assign a plan to help you reach your goals." />
        )}

        {!isLoading && !isError && plans.map(p => (
          <AssignedPlanCard key={p.assignmentId} plan={p} onPress={() => onOpenPlan(p.assignmentId)} />
        ))}
      </ScrollView>
    </Screen>
  );
}
