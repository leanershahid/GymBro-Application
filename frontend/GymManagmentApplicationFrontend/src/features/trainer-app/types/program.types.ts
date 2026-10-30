// ─── Program Builder: workout structure, plan schedule, assignments ──────────
// Mirrors Application/Workout/WorkoutStructureService.cs DTOs.

export const SECTION_TYPES = ['Warmup', 'Main', 'Cooldown', 'Circuit', 'Superset', 'Dropset', 'Pyramid', 'Custom'] as const;
export type SectionType = typeof SECTION_TYPES[number];

export interface StructureExercise {
  exerciseId: number;
  /** Read-only, filled in by the server. */
  exerciseName?: string | null;
  sets: number | null;
  /** "10", "8-12", "AMRAP"… */
  reps: string | null;
  durationSeconds: number | null;
  restSeconds: number | null;
  tempo: string | null;
  weightSuggestion: string | null;
  notes: string | null;
}

export interface StructureSection {
  name: string | null;
  type: string;
  rounds: number;
  restSeconds: number | null;
  exercises: StructureExercise[];
}

export interface WorkoutStructure {
  workoutId?: number;
  workoutName?: string | null;
  sections: StructureSection[];
}

export interface PlanDay {
  /** 1–7 */
  dayNumber: number;
  workoutId: number | null;
  workoutName?: string | null;
  isRestDay: boolean;
}

export interface PlanWeek {
  weekNumber: number;
  notes: string | null;
  days: PlanDay[];
}

export interface PlanSchedule {
  planId?: number;
  planName?: string | null;
  durationWeeks: number;
  weeks: PlanWeek[];
}

export interface AssignWorkoutPayload {
  workoutId: number;
  memberIds: number[];
  /** YYYY-MM-DD */
  assignedAt: string;
  dueDate?: string | null;
  notes?: string | null;
}

export interface AssignPlanPayload {
  memberIds: number[];
  /** YYYY-MM-DD */
  startDate: string;
}

export interface UpdateWorkoutPayload {
  name?: string;
  description?: string;
  /** Enum index (see WORKOUT_GOALS). */
  goal?: number;
  /** Enum index (see WORKOUT_DIFFICULTIES). */
  difficulty?: number;
  durationMin?: number;
}

export interface UpdatePlanPayload {
  name?: string;
  description?: string;
  durationWeeks?: number;
  goal?: number;
  difficulty?: number;
}

export interface LibraryExercise {
  id: number;
  name: string;
  category: string | null;
  difficulty: string | null;
  tags: string[] | null;
}
