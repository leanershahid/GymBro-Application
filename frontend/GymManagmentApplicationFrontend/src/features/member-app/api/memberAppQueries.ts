import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { uploadFile, PickedFile } from '../../../api/upload';
import { ENDPOINTS } from '../../../api/endpoints';
import {
  fetchMyProfile, updateMyProfile,
  fetchMyTimeline, fetchMyDocuments,
  fetchMyWorkouts, fetchWorkoutDetail, completeWorkout, bookmarkWorkout,
  fetchExercises, fetchMyPlans,
  fetchHealthToday, fetchActiveChallenges, fetchAssignedTrainer,
} from './memberAppApi';
import { WorkoutCompletePayload } from '../types/member-app.types';
import { queryKeys } from '../../../api/queryKeys';

const K = queryKeys.memberApp;

export const useMyProfile     = (id: number) =>
  useQuery({ queryKey: K.profile(id),   queryFn: () => fetchMyProfile(id),    select: r => r.data, enabled: id > 0 });

export const useMyTimeline    = (id: number) =>
  useQuery({ queryKey: K.timeline(id),  queryFn: () => fetchMyTimeline(id),   select: r => r.data ?? [], enabled: id > 0 });

export const useMyDocuments   = (id: number) =>
  useQuery({ queryKey: K.documents(id), queryFn: () => fetchMyDocuments(id),  select: r => r.data ?? [], enabled: id > 0 });

export const useMyWorkouts    = (memberId: number, page = 1) =>
  useQuery({ queryKey: K.workouts(memberId, page), queryFn: () => fetchMyWorkouts(memberId, page), select: r => r.data, enabled: memberId > 0 });

export const useWorkoutDetail = (id: number) =>
  useQuery({ queryKey: K.workout(id),   queryFn: () => fetchWorkoutDetail(id), select: r => r.data, enabled: id > 0 });

export const useExerciseList  = (page = 1, tag?: string) =>
  useQuery({ queryKey: K.exercises(page, tag), queryFn: () => fetchExercises(page, 20, tag), select: r => r.data });

export const useMyPlans       = (page = 1) =>
  useQuery({ queryKey: K.plans(page), queryFn: () => fetchMyPlans(page), select: r => r.data });

export const useCompleteWorkout = () =>
  useMutation({ mutationFn: ({ id, payload }: { id: number; payload: WorkoutCompletePayload }) => completeWorkout(id, payload) });

export const useBookmarkWorkout = () =>
  useMutation({ mutationFn: (id: number) => bookmarkWorkout(id) });

export const useUpdateProfile = (id: number) =>
  useMutation({ mutationFn: (p: Parameters<typeof updateMyProfile>[1]) => updateMyProfile(id, p) });

/** Uploads a new profile photo; the profile query refetches with the stored URL. */
export const useUploadPhoto = (id: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: PickedFile) => uploadFile<{ url: string }>(`${ENDPOINTS.MEMBERS}/${id}/photo`, 'photo', file),
    onSuccess: () => qc.invalidateQueries({ queryKey: K.profile(id) }),
  });
};

export const useHealthToday = (userId: number) =>
  useQuery({ queryKey: queryKeys.health.today(userId), queryFn: fetchHealthToday, select: r => r.data, enabled: userId > 0 });

export const useActiveChallenges = (userId: number) =>
  useQuery({ queryKey: queryKeys.challenges.active(userId), queryFn: fetchActiveChallenges, select: r => r.data ?? [], enabled: userId > 0 });

/** The member's assigned trainer (GET /trainers/{id}) — only used to show their real name. */
export const useAssignedTrainer = (trainerId: number | null | undefined) =>
  useQuery({
    queryKey: ['member-assigned-trainer', trainerId ?? 0] as const,
    queryFn: () => fetchAssignedTrainer(trainerId as number),
    select: r => (r.success ? r.data : null),
    enabled: !!trainerId && trainerId > 0,
    retry: false,
  });
