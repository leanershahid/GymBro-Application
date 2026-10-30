import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../api/queryKeys';
import {
  fetchWorkoutStructure, saveWorkoutStructure, fetchPlanSchedule, savePlanSchedule,
  updateWorkout, updatePlan, cloneWorkout, assignWorkout, assignPlan,
  fetchExerciseLibrary, fetchWorkoutOptions,
} from './programApi';
import {
  WorkoutStructure, PlanSchedule, AssignWorkoutPayload, AssignPlanPayload,
  UpdateWorkoutPayload, UpdatePlanPayload,
} from '../types/program.types';

// Local keys (scoped under the shared workouts/plans roots so list invalidation also refreshes them).
const PK = {
  structure: (id: number) => [...queryKeys.workouts.all, 'structure', id] as const,
  options:   () => [...queryKeys.workouts.all, 'options'] as const,
  schedule:  (id: number) => [...queryKeys.plans.all, 'schedule', id] as const,
  library:   () => [...queryKeys.exercises.all, 'library-100'] as const,
};

export const useWorkoutStructure = (id: number) =>
  useQuery({ queryKey: PK.structure(id), queryFn: () => fetchWorkoutStructure(id), select: r => r.data, enabled: id > 0 });

export const useSaveWorkoutStructure = (id: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (s: WorkoutStructure) => saveWorkoutStructure(id, s),
    onSuccess: () => qc.invalidateQueries({ queryKey: PK.structure(id) }),
  });
};

export const usePlanSchedule = (id: number) =>
  useQuery({ queryKey: PK.schedule(id), queryFn: () => fetchPlanSchedule(id), select: r => r.data, enabled: id > 0 });

export const useSavePlanSchedule = (id: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (s: PlanSchedule) => savePlanSchedule(id, s),
    onSuccess: () => qc.invalidateQueries({ queryKey: PK.schedule(id) }),
  });
};

export const useUpdateWorkout = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateWorkoutPayload }) => updateWorkout(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.workouts.all }),
  });
};

export const useUpdatePlan = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdatePlanPayload }) => updatePlan(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.plans.all }),
  });
};

export const useCloneWorkout = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => cloneWorkout(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.workouts.all }),
  });
};

export const useAssignWorkout = () =>
  useMutation({ mutationFn: (p: AssignWorkoutPayload) => assignWorkout(p) });

export const useAssignPlan = () =>
  useMutation({ mutationFn: ({ planId, payload }: { planId: number; payload: AssignPlanPayload }) => assignPlan(planId, payload) });

export const useExerciseLibrary = (enabled = true) =>
  useQuery({ queryKey: PK.library(), queryFn: fetchExerciseLibrary, select: r => r.data?.items ?? [], enabled, staleTime: 5 * 60_000 });

export const useWorkoutOptions = () =>
  useQuery({ queryKey: PK.options(), queryFn: fetchWorkoutOptions, select: r => r.data?.items ?? [] });
