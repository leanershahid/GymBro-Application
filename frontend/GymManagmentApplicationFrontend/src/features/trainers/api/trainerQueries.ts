import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchTrainers, createTrainer, updateTrainer } from './trainerApi';
import { TrainerPayload } from '../types/trainer.types';
import { queryKeys } from '../../../api/queryKeys';

export const useTrainers = (pageNumber = 1, pageSize = 20) =>
  useQuery({
    queryKey: [...queryKeys.trainers.all, pageNumber, pageSize],
    queryFn:  () => fetchTrainers(pageNumber, pageSize),
    select:   (res) => res.data,
  });

export const useCreateTrainer = () =>
  useMutation({
    mutationFn: (payload: TrainerPayload) => createTrainer(payload),
  });

export const useUpdateTrainerAvailability = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isAvailable }: { id: number; isAvailable: boolean }) =>
      updateTrainer(id, { isAvailable }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.trainers.all }),
  });
};
