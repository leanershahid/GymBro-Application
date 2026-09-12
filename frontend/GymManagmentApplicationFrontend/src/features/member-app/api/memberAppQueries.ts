import { useQuery, useMutation } from '@tanstack/react-query';
import {
  fetchMyProfile, updateMyProfile,
  fetchMyTimeline, fetchMyDocuments,
  fetchMyWorkouts, fetchWorkoutDetail, completeWorkout, bookmarkWorkout,
  fetchExercises, fetchMyPlans,
  fetchHealthToday, fetchActiveChallenges,
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

export const useHealthToday = (userId: number) =>
  useQuery({ queryKey: queryKeys.health.today(userId), queryFn: fetchHealthToday, select: r => r.data, enabled: userId > 0 });

export const useActiveChallenges = (userId: number) =>
  useQuery({ queryKey: queryKeys.challenges.active(userId), queryFn: fetchActiveChallenges, select: r => r.data ?? [], enabled: userId > 0 });
