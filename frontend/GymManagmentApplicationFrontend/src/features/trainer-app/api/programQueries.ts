import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../api/queryKeys';
import { updateWorkout, updatePlan, cloneWorkout, assignWorkout } from './programApi';
import { AssignWorkoutPayload, UpdateWorkoutPayload, UpdatePlanPayload } from '../types/program.types';

// Structure, plan schedule and plan assignment moved to features/training (weekly plan builder).

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
