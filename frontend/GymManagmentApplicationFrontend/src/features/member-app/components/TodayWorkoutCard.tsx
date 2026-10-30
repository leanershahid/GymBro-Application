import React from 'react';
import { useMyTraining } from '../api/memberAppQueries';
import { activeTodayPlans, sortOpenWorkouts } from './trainingUtils';
import { PlanTodayCard, AssignedWorkoutCard } from './TrainingCards';

interface Props {
  userId: number;
  onOpenWorkout: (id: number) => void;
}

/**
 * Home card for today's training: the first plan the member is in today (workout or rest day),
 * otherwise their next open assigned workout. Renders nothing while loading, on error, or when
 * nothing is assigned.
 */
export default function TodayWorkoutCard({ userId, onOpenWorkout }: Props) {
  const { data } = useMyTraining(userId);
  if (!data) return null;

  const plan = activeTodayPlans(data.plans)[0];
  if (plan) return <PlanTodayCard plan={plan} onOpenWorkout={onOpenWorkout} />;

  const next = sortOpenWorkouts(data.workouts)[0];
  if (next) return <AssignedWorkoutCard item={next} onOpenWorkout={onOpenWorkout} />;

  return null;
}
