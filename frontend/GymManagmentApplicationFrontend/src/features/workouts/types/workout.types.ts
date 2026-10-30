import { ApiResponse, PaginatedData } from '../../../api/types';

export type { ApiResponse, PaginatedData };

// The API has no JsonStringEnumConverter: enums are SENT as their numeric index and
// RETURNED as their name. Order must match Domain/Enums exactly.
export const WORKOUT_GOALS        = ['WeightLoss', 'MuscleGain', 'Endurance', 'Flexibility', 'General', 'Rehab', 'Sport'] as const;
export const WORKOUT_DIFFICULTIES = ['Beginner', 'Intermediate', 'Advanced', 'Elite'] as const;
export const GOAL_GENERAL = 4;

export type WorkoutGoal       = typeof WORKOUT_GOALS[number];
export type WorkoutDifficulty = typeof WORKOUT_DIFFICULTIES[number];

export interface Workout {
  id: number;
  tenantId: number;
  name: string;
  description: string | null;
  category: string | null;
  goal: WorkoutGoal | null;
  difficulty: WorkoutDifficulty | null;
  durationMin: number | null;
  isPublic: boolean;
  tags: string[] | null;
  createdAt: string;
}

export interface WorkoutPayload {
  tenantId: number;
  name: string;
  description?: string;
  category?: string;
  /** Index into WORKOUT_GOALS (a name is accepted and converted before sending). */
  goal?: number | WorkoutGoal;
  /** Index into WORKOUT_DIFFICULTIES (a name is accepted and converted before sending). */
  difficulty?: number | WorkoutDifficulty;
  durationMin?: number;
  isPublic?: boolean;
  tags?: string[];
}

export type WorkoutListResponse   = ApiResponse<PaginatedData<Workout>>;
export type WorkoutCreateResponse = ApiResponse<Workout>;

// ─── Workout Plan ─────────────────────────────────────────────────
export interface WorkoutPlan {
  id: number;
  tenantId: number;
  name: string;
  description: string | null;
  durationWeeks: number;
  goal: WorkoutGoal | null;
  difficulty: WorkoutDifficulty | null;
  isActive: boolean;
  createdAt: string;
}

export interface WorkoutPlanPayload {
  tenantId: number;
  name: string;
  description?: string;
  durationWeeks: number;
  /** Index into WORKOUT_GOALS (a name is accepted and converted before sending). */
  goal?: number | WorkoutGoal;
  /** Index into WORKOUT_DIFFICULTIES (a name is accepted and converted before sending). */
  difficulty?: number | WorkoutDifficulty;
}

export type PlanListResponse   = ApiResponse<PaginatedData<WorkoutPlan>>;
export type PlanCreateResponse = ApiResponse<WorkoutPlan>;

// ─── Automation Rule ──────────────────────────────────────────────
export interface AutomationRule {
  id: number;
  tenantId: number;
  name: string;
  triggerEvent: string;
  conditions: Record<string, unknown> | null;
  actions: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
}

export interface AutomationRulePayload {
  tenantId: number;
  name: string;
  triggerEvent: string;
  conditions?: Record<string, unknown>;
  actions: Record<string, unknown>;
}

export type AutomationListResponse = ApiResponse<AutomationRule[]>;

/** Enum name → numeric index the API expects (no string-enum converter server-side). */
export function toEnumIndex<N extends string>(names: readonly N[], v: number | N | undefined): number | undefined {
  if (v === undefined || typeof v === 'number') return v;
  const i = names.indexOf(v);
  return i >= 0 ? i : undefined;
}
