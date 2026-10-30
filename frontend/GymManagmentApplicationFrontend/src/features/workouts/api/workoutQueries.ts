import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchWorkouts, fetchWorkout, createWorkout, deleteWorkout,
  fetchPlans, fetchPlan, createPlan, deletePlan,
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

export const useWorkout = (id: number | null) =>
  useQuery({
    queryKey: [...queryKeys.workouts.all, 'detail', id],
    queryFn:  () => fetchWorkout(id as number),
    select:   (res) => res.data,
    enabled:  !!id,
  });

export const useCreateWorkout = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: WorkoutPayload) => createWorkout(p),
    onSuccess:  () => qc.invalidateQueries({ queryKey: queryKeys.workouts.all }),
  });
};

export const useDeleteWorkout = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteWorkout(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: queryKeys.workouts.all }),
  });
};

export const usePlans = (pageNumber = 1, pageSize = 20) =>
  useQuery({
    queryKey: [...queryKeys.plans.all, pageNumber, pageSize],
    queryFn:  () => fetchPlans(pageNumber, pageSize),
    select:   (res) => res.data,
  });

export const usePlan = (id: number | null) =>
  useQuery({
    queryKey: [...queryKeys.plans.all, 'detail', id],
    queryFn:  () => fetchPlan(id as number),
    select:   (res) => res.data,
    enabled:  !!id,
  });

export const useCreatePlan = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: WorkoutPlanPayload) => createPlan(p),
    onSuccess:  () => qc.invalidateQueries({ queryKey: queryKeys.plans.all }),
  });
};

export const useDeletePlan = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deletePlan(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: queryKeys.plans.all }),
  });
};

export const useAutomationRules = (tenantId: number) =>
  useQuery({
    queryKey: [...queryKeys.automation.all, tenantId],
    queryFn:  () => fetchAutomationRules(tenantId),
    select:   (res) => res.data ?? [],
    enabled:  tenantId > 0,
  });

export const useCreateAutomationRule = () =>
  useMutation({ mutationFn: (p: AutomationRulePayload) => createAutomationRule(p) });
