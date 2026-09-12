import { useQuery, useMutation } from '@tanstack/react-query';
import {
  fetchWorkouts, createWorkout,
  fetchPlans, createPlan,
  fetchAutomationRules, createAutomationRule,
} from './workoutApi';
import { WorkoutPayload, WorkoutPlanPayload, AutomationRulePayload } from '../types/workout.types';
import { queryKeys } from '../../../api/queryKeys';

export const useWorkouts = (pageNumber = 1, pageSize = 20) =>
  useQuery({
    queryKey: [...queryKeys.workouts.all, pageNumber, pageSize],
    queryFn:  () => fetchWorkouts(pageNumber, pageSize),
    select:   (res) => res.data,
  });

export const useCreateWorkout = () =>
  useMutation({ mutationFn: (p: WorkoutPayload) => createWorkout(p) });

export const usePlans = (pageNumber = 1, pageSize = 20) =>
  useQuery({
    queryKey: [...queryKeys.plans.all, pageNumber, pageSize],
    queryFn:  () => fetchPlans(pageNumber, pageSize),
    select:   (res) => res.data,
  });

export const useCreatePlan = () =>
  useMutation({ mutationFn: (p: WorkoutPlanPayload) => createPlan(p) });

export const useAutomationRules = (tenantId: number) =>
  useQuery({
    queryKey: [...queryKeys.automation.all, tenantId],
    queryFn:  () => fetchAutomationRules(tenantId),
    select:   (res) => res.data ?? [],
    enabled:  tenantId > 0,
  });

export const useCreateAutomationRule = () =>
  useMutation({ mutationFn: (p: AutomationRulePayload) => createAutomationRule(p) });
