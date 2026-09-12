import { ApiResponse, PaginatedData } from '../../../api/types';

export type { ApiResponse, PaginatedData };

export type WorkoutGoal       = 'General' | 'WeightLoss' | 'MuscleGain' | 'Endurance';
export type WorkoutDifficulty = 'Beginner' | 'Intermediate' | 'Advanced';

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
  goal?: WorkoutGoal;
  difficulty?: WorkoutDifficulty;
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
  goal?: WorkoutGoal;
  difficulty?: WorkoutDifficulty;
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
