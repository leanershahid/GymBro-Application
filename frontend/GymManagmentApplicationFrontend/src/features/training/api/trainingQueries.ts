import { useMutation, useQuery, useQueryClient, QueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../api/queryKeys';
import {
  addWeek, assignPlan, clearDay, copyDay, copyWeek, createPlan, dayFromLibrary, deletePlan, deleteWeek, duplicatePlan,
  fetchBuilder, fetchClientActivePlan, fetchClientBuilder, fetchClientCalendar, fetchLibraryWorkouts, fetchPlanAnalytics,
  fetchPlanMembers, fetchPlans, fetchStructure, moveClientDay, PlanListParams, saveStructure, skipClientDay,
  undoClientOverride, updatePlan, upsertDay,
} from './trainingApi';
import type {
  AssignPlanRequest, BuilderDay, CreatePlanRequest, DateString, DayOverrideRequest, FromLibraryRequest, PlanBuilder,
  PlanDayRef, UpdatePlanRequest, UpsertPlanDayRequest, WorkoutStructure,
} from './training.types';

// Staff-side training keys. Plan lists sit under the shared plans root (so the older workouts
// feature's plan mutations refresh them); the builder has its own root.
const ROOT = ['plan-builder'] as const;
export const trainingKeys = {
  plansRoot: [...queryKeys.plans.all, 'training'] as const,
  plans: (p: PlanListParams) => [...queryKeys.plans.all, 'training', JSON.stringify(p)] as const,
  analytics: (id: number) => [...queryKeys.plans.all, 'training', 'analytics', id] as const,
  members: (id: number) => [...queryKeys.plans.all, 'training', 'members', id] as const,
  clientActive: (clientId: number) => [...queryKeys.plans.all, 'training', 'client-active', clientId] as const,
  builderRoot: [...ROOT, 'builder'] as const,
  builder: (planId: number) => [...ROOT, 'builder', 'plan', planId] as const,
  clientBuilderRoot: [...ROOT, 'builder', 'assignment'] as const,
  clientBuilder: (aid: number) => [...ROOT, 'builder', 'assignment', aid] as const,
  calendar: (aid: number, from?: string, to?: string) => [...ROOT, 'calendar', aid, from ?? null, to ?? null] as const,
  structure: (workoutId: number) => [...ROOT, 'structure', workoutId] as const,
  library: [...queryKeys.workouts.all, 'training-library'] as const,
};
const K = trainingKeys;

/** Puts a fresh builder into the cache: by plan id, and in any client-copy query showing the same plan. */
function storeBuilder(qc: QueryClient, b: PlanBuilder) {
  qc.setQueryData(K.builder(b.planId), b);
  qc.setQueriesData<PlanBuilder>({ queryKey: K.clientBuilderRoot }, old => (old && old.planId === b.planId ? b : old));
}

/** Replaces one day of a cached builder (pure). */
export function withDay(b: PlanBuilder, day: BuilderDay): PlanBuilder {
  return {
    ...b,
    weeks: b.weeks.map(w => (w.weekNumber !== day.weekNumber ? w : {
      ...w, days: w.days.map(d => (d.dayNumber === day.dayNumber ? day : d)),
    })),
  };
}

function storeDay(qc: QueryClient, planId: number, day: BuilderDay) {
  const patch = (old: PlanBuilder | undefined) => (old && old.planId === planId ? withDay(old, day) : old);
  qc.setQueryData<PlanBuilder>(K.builder(planId), patch);
  qc.setQueriesData<PlanBuilder>({ queryKey: K.clientBuilderRoot }, patch);
}

const refreshLists = (qc: QueryClient) => qc.invalidateQueries({ queryKey: K.plansRoot });

// ── Plans ────────────────────────────────────────────────────────────────────
export const useTrainingPlans = (p: PlanListParams = {}) =>
  useQuery({ queryKey: K.plans(p), queryFn: () => fetchPlans(p), placeholderData: prev => prev });

export const usePlanAnalytics = (id: number) =>
  useQuery({ queryKey: K.analytics(id), queryFn: () => fetchPlanAnalytics(id), enabled: id > 0, staleTime: 5 * 60_000 });

export const useCreatePlan = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (p: CreatePlanRequest) => createPlan(p), onSuccess: () => refreshLists(qc) });
};

export const useUpdatePlan = (planId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: UpdatePlanRequest) => updatePlan(planId, p),
    onSuccess: () => { refreshLists(qc); qc.invalidateQueries({ queryKey: K.builderRoot }); },
  });
};

export const useDeletePlan = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: number) => deletePlan(id), onSuccess: () => refreshLists(qc) });
};

export const useDuplicatePlan = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ planId, name }: { planId: number; name?: string }) => duplicatePlan(planId, { name: name ?? null }),
    onSuccess: b => { storeBuilder(qc, b); refreshLists(qc); },
  });
};

// ── Builder ──────────────────────────────────────────────────────────────────
export const usePlanBuilder = (planId: number) =>
  useQuery({ queryKey: K.builder(planId), queryFn: () => fetchBuilder(planId), enabled: planId > 0 });

export const useClientPlanBuilder = (assignmentId: number) =>
  useQuery({ queryKey: K.clientBuilder(assignmentId), queryFn: () => fetchClientBuilder(assignmentId), enabled: assignmentId > 0 });

/** Every builder mutation for one plan; each keeps the cached builder in step with the answer. */
export function useBuilderActions(planId: number) {
  const qc = useQueryClient();
  const onBuilder = (b: PlanBuilder) => { storeBuilder(qc, b); refreshLists(qc); };
  const onDay = (d: BuilderDay) => storeDay(qc, planId, d);

  const upsert = useMutation({
    mutationFn: ({ week, day, body }: { week: number; day: number; body: UpsertPlanDayRequest }) => upsertDay(planId, week, day, body),
    onSuccess: onDay,
  });
  const copy = useMutation({
    mutationFn: ({ dayId, targets }: { dayId: number; targets: PlanDayRef[] }) => copyDay(planId, dayId, { targets }),
    onSuccess: onBuilder,
  });
  const fromLibrary = useMutation({
    mutationFn: ({ dayId, body }: { dayId: number; body: FromLibraryRequest }) => dayFromLibrary(planId, dayId, body),
    onSuccess: onDay,
  });
  const clear = useMutation({ mutationFn: (dayId: number) => clearDay(planId, dayId), onSuccess: onDay });
  const addWeekM = useMutation({ mutationFn: (copyFrom?: number) => addWeek(planId, { copyFrom: copyFrom ?? null }), onSuccess: onBuilder });
  const copyWeekM = useMutation({
    mutationFn: ({ week, toWeeks }: { week: number; toWeeks: number[] }) => copyWeek(planId, week, { toWeeks }),
    onSuccess: onBuilder,
  });
  const deleteWeekM = useMutation({ mutationFn: (week: number) => deleteWeek(planId, week), onSuccess: onBuilder });

  return { upsert, copy, fromLibrary, clear, addWeek: addWeekM, copyWeek: copyWeekM, deleteWeek: deleteWeekM };
}

// ── Assign / members ─────────────────────────────────────────────────────────
export const useAssignPlan = (planId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: AssignPlanRequest) => assignPlan(planId, p),
    onSuccess: r => {
      if ('assigned' in r) {
        qc.invalidateQueries({ queryKey: K.members(planId) });
        qc.invalidateQueries({ queryKey: K.analytics(planId) });
        refreshLists(qc);
      }
    },
  });
};

export const usePlanMembers = (planId: number, enabled = true) =>
  useQuery({ queryKey: K.members(planId), queryFn: () => fetchPlanMembers(planId), enabled: enabled && planId > 0 });

/** The client's active plan assignment (null = none). */
export const useClientActivePlan = (clientId: number) =>
  useQuery({ queryKey: K.clientActive(clientId), queryFn: () => fetchClientActivePlan(clientId), enabled: clientId > 0 });

export const useClientCalendar = (assignmentId: number, from?: DateString, to?: DateString, enabled = true) =>
  useQuery({
    queryKey: K.calendar(assignmentId, from, to),
    queryFn: () => fetchClientCalendar(assignmentId, from, to),
    enabled: enabled && assignmentId > 0,
  });

/** Staff skip / move / undo on a client's plan day. */
export function useClientDayOverrides(assignmentId: number) {
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: [...ROOT, 'calendar', assignmentId] });
    qc.invalidateQueries({ queryKey: K.clientBuilder(assignmentId) });
  };
  const skip = useMutation({ mutationFn: (p: DayOverrideRequest) => skipClientDay(assignmentId, p), onSuccess: refresh });
  const move = useMutation({ mutationFn: (p: DayOverrideRequest) => moveClientDay(assignmentId, p), onSuccess: refresh });
  const undo = useMutation({ mutationFn: (date: DateString) => undoClientOverride(assignmentId, date), onSuccess: refresh });
  return { skip, move, undo };
}

// ── Workouts ─────────────────────────────────────────────────────────────────
export const useLibraryWorkouts = (enabled = true) =>
  useQuery({ queryKey: K.library, queryFn: fetchLibraryWorkouts, select: r => r.items, enabled });

export const useStructure = (workoutId: number) =>
  useQuery({ queryKey: K.structure(workoutId), queryFn: () => fetchStructure(workoutId), enabled: workoutId > 0 });

export const useSaveStructure = (workoutId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (s: WorkoutStructure) => saveStructure(workoutId, s),
    onSuccess: s => {
      qc.setQueryData(K.structure(workoutId), s);
      // Day summaries (count, names, minutes) come from the structure.
      qc.invalidateQueries({ queryKey: K.builderRoot });
    },
  });
};
