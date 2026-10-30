import axiosInstance from '../../../api/axios';
import { ApiResponse } from '../../../api/types';
import { fetchBranches } from '../../branches/api/branchApi';
import { fetchTrainers } from '../../trainers/api/trainerApi';
import { fetchMembers } from '../../members/api/memberApi';
import {
  ClassType, ClassTypePayload, GymClass, ScheduleFilter, CreateClassPayload, UpdateClassPayload,
  CancelClassPayload, RosterEntry, PtType, PtTypePayload, PtSession, PtSessionFilter, BookPtPayload,
  PtStatusPayload, MemberOption, TrainerOption, BranchOption,
} from '../types/classes.types';

// Feature-local paths (kept out of the shared endpoints file).
const EP = {
  classTypes: '/classes/types',
  classType: (id: number) => `/classes/types/${id}`,
  classes: '/classes',
  class: (id: number) => `/classes/${id}`,
  cancel: (id: number) => `/classes/${id}/cancel`,
  roster: (id: number) => `/classes/${id}/roster`,
  attendance: (id: number) => `/classes/${id}/attendance`,
  book: (id: number) => `/classes/${id}/book`,
  ptTypes: '/pt/types',
  ptType: (id: number) => `/pt/types/${id}`,
  ptSessions: '/pt/sessions',
  ptStatus: (id: number) => `/pt/sessions/${id}/status`,
};

/** Unwraps the `{ success, message, data, errors }` envelope. */
const unwrap = <T>(res: { data: ApiResponse<T> }): T => res.data.data as T;
/** Server success message (e.g. "4 classes scheduled."). */
const message = (res: { data: ApiResponse<unknown> }) => res.data.message;

// ─── Class types ─────────────────────────────────────────────────

export const fetchClassTypes = async (includeInactive = false): Promise<ClassType[]> =>
  unwrap(await axiosInstance.get<ApiResponse<ClassType[]>>(EP.classTypes, { params: { includeInactive } })) ?? [];

export const createClassType = async (p: ClassTypePayload): Promise<ClassType> =>
  unwrap(await axiosInstance.post<ApiResponse<ClassType>>(EP.classTypes, p));

export const updateClassType = async (id: number, p: ClassTypePayload): Promise<ClassType> =>
  unwrap(await axiosInstance.put<ApiResponse<ClassType>>(EP.classType(id), p));

// ─── Classes ─────────────────────────────────────────────────────

export const fetchSchedule = async (f: ScheduleFilter): Promise<GymClass[]> =>
  unwrap(await axiosInstance.get<ApiResponse<GymClass[]>>(EP.classes, {
    params: { from: f.from, to: f.to, branchId: f.branchId || undefined, trainerId: f.trainerId || undefined },
  })) ?? [];

/** Returns the server message ("Class scheduled." / "5 classes scheduled."). */
export const createClass = async (p: CreateClassPayload): Promise<string> =>
  message(await axiosInstance.post<ApiResponse<GymClass[]>>(EP.classes, p));

export const updateClass = async (id: number, p: UpdateClassPayload): Promise<GymClass> =>
  unwrap(await axiosInstance.put<ApiResponse<GymClass>>(EP.class(id), p));

export const cancelClass = async (id: number, p: CancelClassPayload): Promise<string> =>
  message(await axiosInstance.post<ApiResponse<{ cancelled: number }>>(EP.cancel(id), p));

export const fetchRoster = async (id: number): Promise<RosterEntry[]> =>
  unwrap(await axiosInstance.get<ApiResponse<RosterEntry[]>>(EP.roster(id))) ?? [];

export const markAttendance = async (id: number, clientId: number, attended: boolean): Promise<string> =>
  message(await axiosInstance.put<ApiResponse<null>>(EP.attendance(id), { clientId, attended }));

/** Staff booking a member; full classes waitlist (the message says so). */
export const bookMember = async (id: number, clientId: number): Promise<string> =>
  message(await axiosInstance.post<ApiResponse<GymClass>>(EP.book(id), { clientId }));

export const unbookMember = async (id: number, clientId: number): Promise<string> =>
  message(await axiosInstance.delete<ApiResponse<GymClass>>(EP.book(id), { params: { clientId } }));

// ─── Personal training ───────────────────────────────────────────

export const fetchPtTypes = async (trainerId?: number | null): Promise<PtType[]> =>
  unwrap(await axiosInstance.get<ApiResponse<PtType[]>>(EP.ptTypes, { params: { trainerId: trainerId || undefined } })) ?? [];

export const createPtType = async (p: PtTypePayload): Promise<PtType> =>
  unwrap(await axiosInstance.post<ApiResponse<PtType>>(EP.ptTypes, p));

export const updatePtType = async (id: number, p: PtTypePayload): Promise<PtType> =>
  unwrap(await axiosInstance.put<ApiResponse<PtType>>(EP.ptType(id), p));

export const fetchPtSessions = async (f: PtSessionFilter): Promise<PtSession[]> =>
  unwrap(await axiosInstance.get<ApiResponse<PtSession[]>>(EP.ptSessions, {
    params: {
      from: f.from || undefined, to: f.to || undefined,
      trainerId: f.trainerId || undefined, clientId: f.clientId || undefined,
    },
  })) ?? [];

export const bookPtSession = async (p: BookPtPayload): Promise<PtSession> =>
  unwrap(await axiosInstance.post<ApiResponse<PtSession>>(EP.ptSessions, p));

export const updatePtStatus = async (id: number, p: PtStatusPayload): Promise<PtSession> =>
  unwrap(await axiosInstance.put<ApiResponse<PtSession>>(EP.ptStatus(id), p));

// ─── Lookups (reuse other features' raw calls, mapped to small options) ──

export const fetchBranchOptions = async (): Promise<BranchOption[]> =>
  ((await fetchBranches()).data ?? []).map(b => ({ id: b.id, name: b.name }));

export const fetchTrainerOptions = async (): Promise<TrainerOption[]> =>
  ((await fetchTrainers(1, 100)).data?.items ?? []).map(t => ({
    id: t.id, userId: t.userId, name: t.displayName, branchId: t.branchId ?? null,
  }));

export const searchMembers = async (query: string): Promise<MemberOption[]> =>
  ((await fetchMembers(query, 1, 20)).data?.items ?? []).map(m => ({
    id: m.id,
    name: `${m.firstName ?? ''} ${m.lastName ?? ''}`.trim() || m.email,
    email: m.email ?? null,
    phone: m.phone ?? null,
  }));
