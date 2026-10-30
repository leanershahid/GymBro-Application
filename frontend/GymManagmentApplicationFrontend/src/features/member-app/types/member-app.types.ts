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
  branchName?: string | null;
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
  durationSec?: number;
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


// ─── Assigned trainer (subset of GET /trainers/{id}) ───────────────
export interface AssignedTrainer {
  id: number;
  displayName: string;
}

// ─── Workout structure (GET /workouts/{id}/structure) ─────────────
export interface StructureExercise {
  exerciseId: number;
  exerciseName: string | null;
  sets: number | null;
  /** "10", "8-12", "AMRAP"… */
  reps: string | null;
  durationSeconds: number | null;
  restSeconds: number | null;
  tempo: string | null;
  weightSuggestion: string | null;
  notes: string | null;
}

export interface WorkoutSection {
  name: string | null;
  /** Warmup | Main | Cooldown | Circuit | Superset | Dropset | Pyramid | Custom */
  type: string;
  rounds: number;
  restSeconds: number | null;
  exercises: StructureExercise[];
}

export interface WorkoutStructure {
  workoutId: number;
  workoutName: string | null;
  sections: WorkoutSection[];
}

// ─── Plan schedule (GET /plans/{id}/schedule) ─────────────────────
export interface PlanDay {
  /** 1 … 7 within the week. */
  dayNumber: number;
  workoutId: number | null;
  workoutName: string | null;
  isRestDay: boolean;
}

export interface PlanWeek {
  weekNumber: number;
  notes: string | null;
  days: PlanDay[];
}

export interface PlanSchedule {
  planId: number;
  planName: string | null;
  durationWeeks: number;
  weeks: PlanWeek[];
}

// ─── My training (GET /me/training) ───────────────────────────────
/** Assigned | InProgress | Completed | Skipped | Expired */
export type AssignmentStatus = string;

export interface AssignedWorkout {
  assignmentId: number;
  workoutId: number;
  workoutName: string;
  trainerName: string | null;
  /** yyyy-MM-dd */
  assignedAt: string;
  dueDate: string | null;
  status: AssignmentStatus;
  notes: string | null;
}

export interface AssignedPlan {
  assignmentId: number;
  planId: number;
  planName: string;
  durationWeeks: number;
  /** yyyy-MM-dd */
  startDate: string;
  status: AssignmentStatus;
  /** Position in the plan today; null before it starts / after it ends. */
  currentWeek: number | null;
  currentDay: number | null;
  todayWorkoutId: number | null;
  todayWorkoutName: string | null;
  todayIsRest: boolean;
}

export interface MyTraining {
  workouts: AssignedWorkout[];
  plans: AssignedPlan[];
}
