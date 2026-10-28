import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchTrainers, fetchTrainerById, createTrainer, updateTrainer, setTrainerStatus, deleteTrainer } from './trainerApi';
import { TrainerPayload } from '../types/trainer.types';
import { queryKeys } from '../../../api/queryKeys';

export const useTrainers = (pageNumber = 1, pageSize = 20) =>
  useQuery({
    queryKey: [...queryKeys.trainers.all, pageNumber, pageSize],
    queryFn:  () => fetchTrainers(pageNumber, pageSize),
    select:   (res) => res.data,
  });

export const useTrainer = (id: number) =>
  useQuery({
    queryKey: [...queryKeys.trainers.all, 'detail', id],
    queryFn:  () => fetchTrainerById(id),
    select:   (res) => res.data,
    enabled:  id > 0,
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

export const useSetTrainerStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => setTrainerStatus(id, isActive),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.trainers.all }),
  });
};

export const useDeleteTrainer = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteTrainer(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.trainers.all }),
  });
};
