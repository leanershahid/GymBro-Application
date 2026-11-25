import { isAxiosError } from 'axios';
import axiosInstance from '../../../api/axios';
import { unwrap, unwrapRequired } from '../../../api/http';
import { currentTenantId } from '../../../api/session';
import type {
  ActivePlanConflict, AddWeekRequest, ApiResponse, AssignPlanRequest, BuilderDay, CopyDayRequest, CopyWeekRequest,
  CreatePlanRequest, DateString, DayOverrideRequest, DuplicatePlanRequest, FromLibraryRequest, PaginatedData,
  PlanAnalyticsResponse, PlanBuilder, PlanCalendar, PlanDayOverride, PlanMember, PlanResponse, TrainingErrorCode,
  UpdatePlanRequest, UpsertPlanDayRequest, WorkoutInUse, WorkoutResponse, WorkoutStructure,
} from './training.types';

// Raw calls for the staff side of training: plan list/CRUD, the weekly plan builder, day workouts,
// assigning, plan members and a client copy's calendar overrides. (Member calls: memberTrainingApi.ts.)

const EP = {
  plans: '/plans',
  plan: (id: number) => `/plans/${id}`,
  analytics: (id: number) => `/plans/${id}/analytics`,
  builder: (id: number) => `/plans/${id}/builder`,
  day: (id: number, w: number, d: number) => `/plans/${id}/weeks/${w}/days/${d}`,
  copyDay: (id: number, dayId: number) => `/plans/${id}/days/${dayId}/copy`,
  fromLibrary: (id: number, dayId: number) => `/plans/${id}/days/${dayId}/from-library`,
  clearDay: (id: number, dayId: number) => `/plans/${id}/days/${dayId}/content`,
  weeks: (id: number) => `/plans/${id}/weeks`,
  week: (id: number, w: number) => `/plans/${id}/weeks/${w}`,
  copyWeek: (id: number, w: number) => `/plans/${id}/weeks/${w}/copy`,
  duplicate: (id: number) => `/plans/${id}/duplicate`,
  assign: (id: number) => `/plans/${id}/assign`,
  members: (id: number) => `/plans/${id}/members`,
  clientBuilder: (aid: number) => `/plans/assignments/${aid}/builder`,
  clientCalendar: (aid: number) => `/plans/assignments/${aid}/calendar`,
  skip: (aid: number) => `/plans/assignments/${aid}/days/skip`,
  move: (aid: number) => `/plans/assignments/${aid}/days/move`,
  override: (aid: number, date: DateString) => `/plans/assignments/${aid}/days/${date}/override`,
  workouts: '/workouts',
  workout: (id: number) => `/workouts/${id}`,
  structure: (id: number) => `/workouts/${id}/structure`,
};

const get = async <T,>(url: string, params?: Record<string, unknown>): Promise<T> =>
  unwrapRequired((await axiosInstance.get<ApiResponse<T>>(url, { params })).data);
const post = async <T,>(url: string, body?: unknown): Promise<T> =>
  unwrapRequired((await axiosInstance.post<ApiResponse<T>>(url, body ?? {})).data);
const put = async <T,>(url: string, body: unknown): Promise<T> =>
  unwrapRequired((await axiosInstance.put<ApiResponse<T>>(url, body)).data);
const del = async <T,>(url: string): Promise<T> => unwrap((await axiosInstance.delete<ApiResponse<T>>(url)).data);

// ── Coded conflicts (409 with `code`, and `data`) ────────────────────────────
type CodedBody = ApiResponse<unknown> & { code?: string | null };

/**
 * The body of a coded answer, from a thrown 409 or from a `success: false` envelope that came back
 * with status 200 (preview mocks). Null when the error is something else.
 */
export function codedBody(e: unknown, code: TrainingErrorCode): CodedBody | null {
  if (isAxiosError<CodedBody>(e)) return e.response?.data?.code === code ? e.response.data : null;
  const body = e as CodedBody | null;
  return body && typeof body === 'object' && body.success === false && body.code === code ? body : null;
}

/** The 409 WORKOUT_IN_USE data, or null for any other error. */
export function workoutInUseFrom(e: unknown): WorkoutInUse | null {
  const body = codedBody(e, 'WORKOUT_IN_USE');
  return body ? ((body.data as WorkoutInUse | null) ?? { planDays: 0, assignments: 0, logs: 0 }) : null;
}

/** Friendly text for a workout that can't be deleted because it is still used. */
export function workoutInUseText(u: WorkoutInUse): string {
  const parts = [
    u.planDays ? `${u.planDays} plan day${u.planDays === 1 ? '' : 's'}` : null,
    u.assignments ? `${u.assignments} assignment${u.assignments === 1 ? '' : 's'}` : null,
    u.logs ? `${u.logs} logged session${u.logs === 1 ? '' : 's'}` : null,
  ].filter(Boolean);
  return `This workout is still used${parts.length ? ` by ${parts.join(', ')}` : ''}, so it can't be deleted. `
    + 'Remove it from those plans first, or keep it and make a copy to change instead.';
}

// ── Plans ────────────────────────────────────────────────────────────────────
export interface PlanListParams { goal?: number; pageNumber?: number; pageSize?: number; includeClientCopies?: boolean }

export const fetchPlans = (p: PlanListParams = {}) =>
  get<PaginatedData<PlanResponse>>(EP.plans, { pageNumber: 1, pageSize: 20, ...p });
export const fetchPlan = (id: number) => get<PlanResponse>(EP.plan(id));
export const createPlan = (p: CreatePlanRequest) => post<PlanResponse>(EP.plans, { ...p, tenantId: currentTenantId() });
export const updatePlan = (id: number, p: UpdatePlanRequest) => put<PlanResponse>(EP.plan(id), p);
export const deletePlan = (id: number) => del<null>(EP.plan(id));
export const fetchPlanAnalytics = (id: number) => get<PlanAnalyticsResponse>(EP.analytics(id));

// ── Builder ──────────────────────────────────────────────────────────────────
export const fetchBuilder = (planId: number) => get<PlanBuilder>(EP.builder(planId));
export const fetchClientBuilder = (assignmentId: number) => get<PlanBuilder>(EP.clientBuilder(assignmentId));
export const upsertDay = (planId: number, week: number, day: number, p: UpsertPlanDayRequest) =>
  put<BuilderDay>(EP.day(planId, week, day), p);
export const copyDay = (planId: number, dayId: number, p: CopyDayRequest) => post<PlanBuilder>(EP.copyDay(planId, dayId), p);
export const dayFromLibrary = (planId: number, dayId: number, p: FromLibraryRequest) => post<BuilderDay>(EP.fromLibrary(planId, dayId), p);
export const clearDay = (planId: number, dayId: number) => del<BuilderDay>(EP.clearDay(planId, dayId));
export const addWeek = (planId: number, p: AddWeekRequest = {}) => post<PlanBuilder>(EP.weeks(planId), p);
export const copyWeek = (planId: number, week: number, p: CopyWeekRequest) => post<PlanBuilder>(EP.copyWeek(planId, week), p);
export const deleteWeek = async (planId: number, week: number) =>
  unwrapRequired((await axiosInstance.delete<ApiResponse<PlanBuilder>>(EP.week(planId, week))).data);
export const duplicatePlan = (planId: number, p: DuplicatePlanRequest = {}) => post<PlanBuilder>(EP.duplicate(planId), p);

// ── Assign / members ─────────────────────────────────────────────────────────
export type AssignResult = { assigned: PlanMember[] } | { conflicts: ActivePlanConflict[] };

/** Assigns the plan; a 409 PLAN_ALREADY_ACTIVE comes back as `conflicts` (resend with replaceExisting). */
export async function assignPlan(planId: number, p: AssignPlanRequest): Promise<AssignResult> {
  let body: CodedBody;
  try {
    body = (await axiosInstance.post<CodedBody>(EP.assign(planId), p)).data;
  } catch (e) {
    const coded = codedBody(e, 'PLAN_ALREADY_ACTIVE');
    if (!coded) throw e;
    body = coded;
  }
  if (!body.success && body.code === 'PLAN_ALREADY_ACTIVE') return { conflicts: (body.data as ActivePlanConflict[] | null) ?? [] };
  return { assigned: unwrap(body as ApiResponse<PlanMember[]>, []) };
}

export const fetchPlanMembers = (planId: number) => get<PlanMember[]>(EP.members(planId));
export const fetchClientCalendar = (assignmentId: number, from?: DateString, to?: DateString) =>
  get<PlanCalendar>(EP.clientCalendar(assignmentId), { from, to });
export const skipClientDay = (assignmentId: number, p: DayOverrideRequest) => post<PlanDayOverride>(EP.skip(assignmentId), p);
export const moveClientDay = (assignmentId: number, p: DayOverrideRequest) => post<PlanDayOverride>(EP.move(assignmentId), p);
export const undoClientOverride = (assignmentId: number, date: DateString) => del<null>(EP.override(assignmentId, date));

/**
 * The client's active plan assignment (their own copy), or null. There is no "by client" endpoint:
 * finds their active copy in the plan list, then its assignment in the copy's members.
 */
export async function fetchClientActivePlan(clientId: number): Promise<PlanMember | null> {
  const copies = await fetchPlans({ includeClientCopies: true, pageSize: 100 });
  const mine = copies.items
    .filter(p => !p.isTemplate && p.ownerClientId === clientId && p.isActive)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const copy of mine) {
    const members = await fetchPlanMembers(copy.id);
    const active = members.find(m => m.clientId === clientId && (m.status === 'Assigned' || m.status === 'InProgress'));
    if (active) return active;
  }
  return null;
}

// ── Workouts (library + structure) ───────────────────────────────────────────
export const fetchLibraryWorkouts = () => get<PaginatedData<WorkoutResponse>>(EP.workouts, { pageNumber: 1, pageSize: 100 });
export const fetchStructure = (workoutId: number) => get<WorkoutStructure>(EP.structure(workoutId));
export const saveStructure = (workoutId: number, s: WorkoutStructure) => put<WorkoutStructure>(EP.structure(workoutId), s);
