import { ApiResponse, PaginatedData } from '../../../api/types';

export type { ApiResponse, PaginatedData };

// ─── Auth / Profile ───────────────────────────────────────────────
export interface MemberProfile {
  id: number;
  tenantId: number;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  gender: string | null;
  dob: string | null;
  avatarUrl: string | null;
  status: string;
  trainerId: number | null;
  branchId: number | null;
  createdAt: string;
}

// ─── Timeline event ───────────────────────────────────────────────
export interface TimelineEvent {
  eventType: string;
  description: string;
  occurredAt: string;
}

// ─── Document ─────────────────────────────────────────────────────
export interface MemberDocument {
  id: number;
  fileName: string;
  url: string;
  documentType: string;
  uploadedAt: string;
}

// ─── Workout (member-facing detail) ──────────────────────────────
export interface WorkoutExercise {
  exerciseId: number;
  name: string;
  sets: number;
  reps: number;
  restSec: number;
}

export interface WorkoutDetail {
  id: number;
  name: string;
  goal: string | null;
  difficulty: string | null;
  durationMin: number | null;
  description: string | null;
  exercises: WorkoutExercise[];
}

// ─── Workout completion payload ───────────────────────────────────
export interface WorkoutSetLog {
  exerciseId: number;
  setNo: number;
  reps: number;
  weightKg: number;
  rpe?: number;
}

export interface WorkoutCompletePayload {
  clientId: number;
  startedAt: string;
  endedAt: string;
  calories?: number;
  notes?: string;
  moodBefore?: number;
  moodAfter?: number;
  fatigueLevel?: number;
  sets: WorkoutSetLog[];
}

// ─── Health / streak (today snapshot) ─────────────────────────────
export interface HealthRing {
  current: number;
  goal: number;
}

export interface HealthToday {
  rings: { move: HealthRing; train: HealthRing; stand: HealthRing };
  stats: {
    bpm: number | null;
    waterLiters: number | null;
    sleepHours: number | null;
    energyPct: number | null;
  };
  streakDays: number;
  coachTip: string | null;
}

// ─── Active challenges ─────────────────────────────────────────────
export interface ActiveChallenge {
  id: number;
  title: string;
  participantCount: number;
  prizeLabel: string | null;
  progressPct: number;
  isJoined: boolean;
}

