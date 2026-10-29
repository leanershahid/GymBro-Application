import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchExercises, fetchExercise, fetchMuscles, createExercise, deleteExercise, uploadExerciseVideo,
} from './exerciseApi';
import { ExercisePayload } from '../types/exercise.types';
import { PickedFile } from '../../../api/upload';
import { queryKeys } from '../../../api/queryKeys';

export const useExercises = (pageNumber = 1, pageSize = 20) =>
  useQuery({
    queryKey: [...queryKeys.exercises.all, pageNumber, pageSize],
    queryFn:  () => fetchExercises(pageNumber, pageSize),
    select:   (res) => res.data,
  });

export const useExercise = (id: number | null) =>
  useQuery({
    queryKey: [...queryKeys.exercises.all, 'detail', id],
    queryFn:  () => fetchExercise(id as number),
    select:   (res) => res.data,
    enabled:  !!id,
  });

export const useMuscles = () =>
  useQuery({
    queryKey: [...queryKeys.exercises.all, 'muscles'],
    queryFn:  fetchMuscles,
    select:   (res) => res.data ?? [],
    staleTime: 10 * 60 * 1000,
  });

export const useCreateExercise = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: ExercisePayload) => createExercise(p),
    onSuccess:  () => qc.invalidateQueries({ queryKey: queryKeys.exercises.all }),
  });
};

export const useUploadExerciseVideo = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: number; file: PickedFile }) => uploadExerciseVideo(id, file),
    onSuccess:  () => qc.invalidateQueries({ queryKey: queryKeys.exercises.all }),
  });
};

export const useDeleteExercise = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteExercise(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: queryKeys.exercises.all }),
  });
};
