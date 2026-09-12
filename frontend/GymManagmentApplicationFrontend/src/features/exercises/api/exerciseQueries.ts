import { useQuery, useMutation } from '@tanstack/react-query';
import { fetchExercises, createExercise, deleteExercise } from './exerciseApi';
import { ExercisePayload } from '../types/exercise.types';
import { queryKeys } from '../../../api/queryKeys';

export const useExercises = (pageNumber = 1, pageSize = 20, tag?: string) =>
  useQuery({
    queryKey: [...queryKeys.exercises.all, pageNumber, pageSize, tag],
    queryFn:  () => fetchExercises(pageNumber, pageSize, tag),
    select:   (res) => res.data,
  });

export const useCreateExercise = () =>
  useMutation({ mutationFn: (p: ExercisePayload) => createExercise(p) });

export const useDeleteExercise = () =>
  useMutation({ mutationFn: (id: number) => deleteExercise(id) });
