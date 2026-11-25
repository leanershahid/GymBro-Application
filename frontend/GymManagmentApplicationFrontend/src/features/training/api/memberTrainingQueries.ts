/**
 * React Query hooks for the member's training (calendar, skip/move, last performance, records,
 * history, player structure, complete). Every key sits under the `member-training` root, the same
 * root as GET /me/training (memberAppQueries `trainingKeys.mine`), so one invalidation refreshes
 * the week strip, calendar, history and records after a session or a skip/move.
 */
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  completeWorkoutSession, fetchLastPerformances, fetchMyRecords, fetchPlanCalendar, fetchPlayerStructure,
  fetchWorkoutHistory, fetchWorkoutHistoryDetail, movePlanDay, skipPlanDay, undoPlanDayOverride,
} from './memberTrainingApi';
import type { CompleteWorkoutRequest, DateString } from './training.types';

const ROOT = 'member-training' as const;

export const memberTrainingKeys = {
  root:      [ROOT] as const,
  calendar:  (aid: number, from?: string, to?: string) => [ROOT, 'calendar', aid, from ?? '', to ?? ''] as const,
  calendarOf: (aid: number) => [ROOT, 'calendar', aid] as const,
  last:      (ids: readonly number[]) => [ROOT, 'last', [...ids].sort((a, b) => a - b).join(',')] as const,
  records:   (exerciseId?: number) => [ROOT, 'records', exerciseId ?? 0] as const,
  history:   () => [ROOT, 'history'] as const,
  historyLog: (logId: number) => [ROOT, 'history-log', logId] as const,
  structure: (workoutId: number) => [ROOT, 'structure', workoutId] as const,
};
const K = memberTrainingKeys;

export const usePlanCalendar = (aid: number, from?: DateString, to?: DateString) =>
  useQuery({ queryKey: K.calendar(aid, from, to), queryFn: () => fetchPlanCalendar(aid, from, to), enabled: aid > 0 });

/** Skip / move / undo a plan day; refreshes /me/training and every calendar of the plan. */
export const usePlanDayOverride = (aid: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a: { kind: 'skip'; date: DateString } | { kind: 'move'; date: DateString; toDate: DateString } | { kind: 'undo'; date: DateString }) => {
      if (a.kind === 'skip') await skipPlanDay(aid, a.date);
      else if (a.kind === 'move') await movePlanDay(aid, a.date, a.toDate);
      else await undoPlanDayOverride(aid, a.date);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: K.root }),
  });
};

export const useLastPerformances = (exerciseIds: readonly number[]) =>
  useQuery({
    queryKey: K.last(exerciseIds),
    queryFn: () => fetchLastPerformances([...new Set(exerciseIds)]),
    enabled: exerciseIds.length > 0,
  });

export const useMyRecords = (exerciseId?: number) =>
  useQuery({ queryKey: K.records(exerciseId), queryFn: () => fetchMyRecords(exerciseId) });

export const useWorkoutHistory = (pageSize = 20) =>
  useInfiniteQuery({
    queryKey: K.history(),
    queryFn: ({ pageParam }) => fetchWorkoutHistory(pageParam, pageSize),
    initialPageParam: 1,
    getNextPageParam: last => (last.pageNumber < last.totalPages ? last.pageNumber + 1 : undefined),
  });

export const useWorkoutHistoryDetail = (logId: number) =>
  useQuery({ queryKey: K.historyLog(logId), queryFn: () => fetchWorkoutHistoryDetail(logId), enabled: logId > 0 });

export const usePlayerStructure = (workoutId: number) =>
  useQuery({ queryKey: K.structure(workoutId), queryFn: () => fetchPlayerStructure(workoutId), enabled: workoutId > 0 });

/** Logs a session; on success the week strip, history, records and last values refetch. */
export const useCompleteSession = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ workoutId, body }: { workoutId: number; body: CompleteWorkoutRequest }) => completeWorkoutSession(workoutId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: K.root }),
  });
};
