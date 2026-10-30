import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  fetchClassTypes, createClassType, updateClassType, fetchSchedule, createClass, updateClass, cancelClass,
  fetchRoster, markAttendance, bookMember, unbookMember, fetchPtTypes, createPtType, updatePtType,
  fetchPtSessions, bookPtSession, updatePtStatus, fetchBranchOptions, fetchTrainerOptions, searchMembers,
} from './classesApi';
import { getSession } from '../../../api/session';
import {
  ClassTypePayload, ScheduleFilter, CreateClassPayload, UpdateClassPayload, CancelClassPayload,
  PtTypePayload, PtSessionFilter, BookPtPayload, PtStatusPayload,
} from '../types/classes.types';

// Feature-local keys. Anything that changes a class refreshes the whole `classes` schedule subtree.
export const classKeys = {
  all:       ['classes'] as const,
  types:     (includeInactive: boolean) => ['classes', 'types', includeInactive] as const,
  typesAll:  ['classes', 'types'] as const,
  schedule:  ['classes', 'schedule'] as const,
  week:      (f: ScheduleFilter) => ['classes', 'schedule', f.from, f.to, f.branchId ?? null, f.trainerId ?? null] as const,
  roster:    (id: number) => ['classes', 'schedule', 'roster', id] as const,
  branches:  ['classes', 'lookup', 'branches'] as const,
  trainers:  ['classes', 'lookup', 'trainers'] as const,
  members:   (q: string) => ['classes', 'lookup', 'members', q] as const,
};

export const ptKeys = {
  all:      ['pt'] as const,
  typesAll: ['pt', 'types'] as const,
  types:    (trainerId?: number | null) => ['pt', 'types', trainerId ?? null] as const,
  sessionsAll: ['pt', 'sessions'] as const,
  sessions: (f: PtSessionFilter) => ['pt', 'sessions', f.from ?? null, f.to ?? null, f.trainerId ?? null, f.clientId ?? null] as const,
};

// ─── Lookups ─────────────────────────────────────────────────────

/** Branches are admin-only on the server; pass enabled=false for trainers. */
export const useBranchOptions = (enabled = true) =>
  useQuery({ queryKey: classKeys.branches, queryFn: fetchBranchOptions, enabled, staleTime: 5 * 60_000 });

export const useTrainerOptions = (enabled = true) =>
  useQuery({ queryKey: classKeys.trainers, queryFn: fetchTrainerOptions, enabled, staleTime: 5 * 60_000 });

/** The signed-in trainer's own profile (matched by user id), when they are one. */
export const useMyTrainerProfile = (enabled = true) => {
  const q = useTrainerOptions(enabled);
  const me = getSession()?.userId;
  return { ...q, me: q.data?.find(t => t.userId === me) ?? null };
};

export const useMemberSearch = (query: string, enabled = true) =>
  useQuery({
    queryKey: classKeys.members(query),
    queryFn: () => searchMembers(query),
    enabled,
    placeholderData: keepPreviousData,
  });

// ─── Class types ─────────────────────────────────────────────────

export const useClassTypes = (includeInactive = false) =>
  useQuery({ queryKey: classKeys.types(includeInactive), queryFn: () => fetchClassTypes(includeInactive) });

export const useSaveClassType = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: ClassTypePayload }) =>
      id ? updateClassType(id, payload) : createClassType(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: classKeys.typesAll }),
  });
};

// ─── Classes ─────────────────────────────────────────────────────

export const useSchedule = (f: ScheduleFilter) =>
  useQuery({ queryKey: classKeys.week(f), queryFn: () => fetchSchedule(f), placeholderData: keepPreviousData });

const useScheduleMutation = <V, R>(fn: (v: V) => Promise<R>) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: classKeys.schedule }),
  });
};

export const useCreateClass = () => useScheduleMutation((p: CreateClassPayload) => createClass(p));
export const useUpdateClass = () => useScheduleMutation(({ id, payload }: { id: number; payload: UpdateClassPayload }) => updateClass(id, payload));
export const useCancelClass = () => useScheduleMutation(({ id, payload }: { id: number; payload: CancelClassPayload }) => cancelClass(id, payload));
export const useMarkAttendance = () =>
  useScheduleMutation(({ id, clientId, attended }: { id: number; clientId: number; attended: boolean }) => markAttendance(id, clientId, attended));
export const useBookMember = () => useScheduleMutation(({ id, clientId }: { id: number; clientId: number }) => bookMember(id, clientId));
export const useUnbookMember = () => useScheduleMutation(({ id, clientId }: { id: number; clientId: number }) => unbookMember(id, clientId));

export const useRoster = (id: number | null) =>
  useQuery({ queryKey: classKeys.roster(id ?? 0), queryFn: () => fetchRoster(id!), enabled: !!id });

// ─── Personal training ───────────────────────────────────────────

export const usePtTypes = (trainerId?: number | null, enabled = true) =>
  useQuery({ queryKey: ptKeys.types(trainerId), queryFn: () => fetchPtTypes(trainerId), enabled });

export const useSavePtType = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: PtTypePayload }) =>
      id ? updatePtType(id, payload) : createPtType(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ptKeys.typesAll }),
  });
};

export const usePtSessions = (f: PtSessionFilter) =>
  useQuery({ queryKey: ptKeys.sessions(f), queryFn: () => fetchPtSessions(f), placeholderData: keepPreviousData });

export const useBookPt = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: BookPtPayload) => bookPtSession(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: ptKeys.sessionsAll }),
  });
};

export const useUpdatePtStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: PtStatusPayload }) => updatePtStatus(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ptKeys.sessionsAll }),
  });
};
