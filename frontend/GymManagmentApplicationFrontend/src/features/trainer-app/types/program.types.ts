// ─── Program Builder: workout/plan details and single-workout assignment ─────
// (Workout structure, plan schedule and plan assignment: features/training/api/training.types.ts.)

export interface AssignWorkoutPayload {
  workoutId: number;
  memberIds: number[];
  /** YYYY-MM-DD */
  assignedAt: string;
  dueDate?: string | null;
  notes?: string | null;
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
