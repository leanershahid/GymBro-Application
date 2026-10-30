import { ApiResponse, PaginatedData } from '../../../api/types';

export type { ApiResponse, PaginatedData };

// The API has no JsonStringEnumConverter: enums are SENT as their numeric index and
// RETURNED as their name (Enum.ToString()). Order must match Domain/Enums exactly.
export const EXERCISE_CATEGORIES = ['Strength', 'Cardio', 'Flexibility', 'Balance', 'Sport', 'Rehab', 'Other'] as const;
export const DIFFICULTIES        = ['Beginner', 'Intermediate', 'Advanced', 'Elite'] as const;

export type ExerciseCategory   = typeof EXERCISE_CATEGORIES[number];
export type ExerciseDifficulty = typeof DIFFICULTIES[number];

export interface ExerciseMuscle    { id: number; name: string; role: string }
export interface ExerciseEquipment { id: number; name: string; category: string | null }
export interface MuscleGroup       { id: number; name: string }

export interface Exercise {
  id: number;
  name: string;
  slug?: string;
  description: string | null;
  instructions: string | null;
  category: string | null;
  difficulty: string | null;
  videoUrl: string | null;
  thumbnailUrl?: string | null;
  isCustom?: boolean;
  tags: string[] | null;
  muscles?: ExerciseMuscle[] | null;
  equipment?: ExerciseEquipment[] | null;
  createdAt: string;
}

/** CreateExerciseRequest. Category/Difficulty are enum indexes (see EXERCISE_CATEGORIES / DIFFICULTIES). */
export interface ExercisePayload {
  tenantId?: number;
  name: string;
  description?: string;
  instructions?: string;
  category: number;
  difficulty: number;
  tags?: string[];
  muscleIds?: number[];
  equipmentIds?: number[];
}

export type ExerciseListResponse   = ApiResponse<PaginatedData<Exercise>>;
export type ExerciseCreateResponse = ApiResponse<Exercise>;
