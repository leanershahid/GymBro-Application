import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchExercises, fetchExerciseLibrary, fetchExercise, fetchMuscles, createExercise, deleteExercise, uploadExerciseVideo,
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

/** Tag-filtered library page (ARCH-072: the program builder used member-app's hook for this). */
export const useExerciseLibrary = (pageNumber = 1, tag?: string, enabled = true, pageSize = 20) =>
  useQuery({
    queryKey: [...queryKeys.exercises.all, 'library', pageNumber, pageSize, tag ?? null],
    queryFn:  () => fetchExerciseLibrary(pageNumber, pageSize, tag),
    select:   (res) => res.data,
    enabled,
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
