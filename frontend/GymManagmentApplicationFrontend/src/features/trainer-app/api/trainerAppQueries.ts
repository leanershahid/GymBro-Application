import { useQuery, useMutation } from '@tanstack/react-query';
import {
  fetchTrainerProfile, updateTrainerProfile,
  fetchSchedule, updateSchedule,
  fetchPerformance, fetchEarnings,
  fetchMyClients, fetchClientProfile, fetchClientTimeline,
  fetchClientNotes, addClientNote, fetchClientDocuments,
  fetchPlanAnalytics,
} from './trainerAppApi';
import { ScheduleSlot } from '../types/trainer-app.types';
import { queryKeys } from '../../../api/queryKeys';

const K = queryKeys.trainerApp;

export const useTrainerProfile  = (id: number) =>
  useQuery({ queryKey: K.profile(id),     queryFn: () => fetchTrainerProfile(id),  select: r => r.data, enabled: id > 0 });

export const useTrainerSchedule = (id: number) =>
  useQuery({ queryKey: K.schedule(id),    queryFn: () => fetchSchedule(id),         select: r => r.data ?? [], enabled: id > 0 });

export const useTrainerPerformance = (id: number) =>
  useQuery({ queryKey: K.performance(id), queryFn: () => fetchPerformance(id),      select: r => r.data, enabled: id > 0 });

export const useTrainerEarnings = (id: number, month?: number, year?: number) =>
  useQuery({ queryKey: K.earnings(id, month, year), queryFn: () => fetchEarnings(id, month, year), select: r => r.data, enabled: id > 0 });

export const useMyClients = (trainerId: number) =>
  useQuery({ queryKey: K.clients(trainerId),  queryFn: () => fetchMyClients(trainerId),  select: r => r.data ?? [], enabled: trainerId > 0 });

export const useClientProfile  = (memberId: number) =>
  useQuery({ queryKey: K.clientProf(memberId),  queryFn: () => fetchClientProfile(memberId),  select: r => r.data, enabled: memberId > 0 });

export const useClientTimeline = (memberId: number) =>
  useQuery({ queryKey: K.clientTime(memberId),  queryFn: () => fetchClientTimeline(memberId), select: r => r.data ?? [], enabled: memberId > 0 });

export const useClientNotes = (memberId: number) =>
  useQuery({ queryKey: K.clientNotes(memberId), queryFn: () => fetchClientNotes(memberId),    select: r => r.data ?? [], enabled: memberId > 0 });

export const useClientDocuments = (memberId: number) =>
  useQuery({ queryKey: K.clientDocs(memberId),  queryFn: () => fetchClientDocuments(memberId),select: r => r.data ?? [], enabled: memberId > 0 });

export const usePlanAnalytics = (planId: number) =>
  useQuery({ queryKey: K.planAnalytics(planId), queryFn: () => fetchPlanAnalytics(planId),    select: r => r.data, enabled: planId > 0 });

export const useUpdateTrainerProfile = (id: number) =>
  useMutation({ mutationFn: (p: Parameters<typeof updateTrainerProfile>[1]) => updateTrainerProfile(id, p) });

export const useUpdateSchedule = (id: number) =>
  useMutation({ mutationFn: (slots: ScheduleSlot[]) => updateSchedule(id, slots) });

export const useAddClientNote = () =>
  useMutation({ mutationFn: ({ memberId, note, trainerId }: { memberId: number; note: string; trainerId: number }) => addClientNote(memberId, note, trainerId) });
