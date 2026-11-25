/**
 * Training API contract — weekly plan builder, day workouts, member training (backend: WeeklyPlanBuilder).
 *
 * Every response is the usual envelope `ApiResponse<T>` ({ success, message, data, errors, code? }).
 * Ids are numbers, dates `yyyy-MM-dd`, timestamps ISO-8601 UTC. Base path: /api.
 * Roles: A = admin (+ staff/custom roles with the module grant), T = trainer, M = member (client).
 * Trainers edit plans they created and the plan copies of clients assigned to them; they assign only to
 * their own clients. Errors: 400 validation, 403 not allowed, 404 not found / not visible, 409 conflicts
 * (with `code`, and `data` where noted).
 *
 * ── Plan model ─────────────────────────────────────────────────────────────────────────────────────────
 * A plan is `durationWeeks` × 7 days. Every day OWNS its own workout (a workout row with
 * `ownerPlanDayId`), edited with the existing structure endpoints. Day workouts never appear in the
 * library. Assigning a master plan (`isTemplate: true`) deep-copies it per member (`isTemplate: false`,
 * `ownerClientId`, `sourcePlanId`); editing a copy never changes the master and vice versa.
 *
 * ── Plans (CRUD unchanged except the new fields) ───────────────────────────────────────────────────────
 * GET    /plans?goal&pageNumber&pageSize&includeClientCopies   A T M   → PaginatedData<PlanResponse>
 *          Staff: masters only unless includeClientCopies=true. Members: plans assigned to them (their copies).
 * POST   /plans                         A T   CreatePlanRequest            → PlanResponse
 * GET    /plans/{id}                    A T M                              → PlanResponse   (M: assigned plans only)
 * PUT    /plans/{id}                    A T   UpdatePlanRequest            → PlanResponse
 * DELETE /plans/{id}                    A                                  → null (archives: isActive=false)
 * GET    /plans/{id}/analytics          A T                                → PlanAnalyticsResponse (counts master + copies)
 * REMOVED: GET /plans/{id}/tree, POST /plans/{id}/branch, PUT /plans/{id}/progression.
 *
 * ── Builder ───────────────────────────────────────────────────────────────────────────────────────────
 * GET    /plans/{id}/builder                          A T M   → PlanBuilder  (M: own plans, read-only)
 * PUT    /plans/{id}/weeks/{w}/days/{d}               A T   UpsertPlanDayRequest → BuilderDay
 *          Creates the day (and, unless rest, its own workout; copy-on-write if it still pointed at a shared
 *          library workout). Idempotent: call it before opening the DayEditor to get `workoutId` + `dayId`.
 * POST   /plans/{id}/days/{dayId}/copy                A T   CopyDayRequest       → PlanBuilder
 * POST   /plans/{id}/days/{dayId}/from-library        A T   FromLibraryRequest   → BuilderDay
 * DELETE /plans/{id}/days/{dayId}/content             A T                        → BuilderDay (empty day)
 * POST   /plans/{id}/weeks                            A T   AddWeekRequest       → PlanBuilder (appends week N+1)
 * POST   /plans/{id}/weeks/{w}/copy                   A T   CopyWeekRequest      → PlanBuilder
 * DELETE /plans/{id}/weeks/{w}                        A T                        → PlanBuilder (later weeks renumber)
 * POST   /plans/{id}/duplicate                        A T   DuplicatePlanRequest → PlanBuilder (new master)
 * Day contents: GET/PUT /workouts/{dayWorkoutId}/structure (below).
 *
 * ── Assign and members ────────────────────────────────────────────────────────────────────────────────
 * POST   /plans/{id}/assign        A T   AssignPlanRequest → PlanMember[]
 *          409 code PLAN_ALREADY_ACTIVE, data: ActivePlanConflict[] → ask, then resend with replaceExisting: true.
 * GET    /plans/{id}/members       A T   → PlanMember[] (assignments of the plan and of its members' copies; T: own clients)
 * GET    /plans/assignments/{assignmentId}/builder     A T   → PlanBuilder (the member's copy; edit it with the builder routes using its planId)
 * GET    /plans/assignments/{assignmentId}/calendar?from&to   A T → PlanCalendar
 * POST   /plans/assignments/{assignmentId}/days/skip   A T   DayOverrideRequest {date}          → PlanDayOverride
 * POST   /plans/assignments/{assignmentId}/days/move   A T   DayOverrideRequest {date, toDate}  → PlanDayOverride
 * DELETE /plans/assignments/{assignmentId}/days/{date}/override  A T                       → null (undo)
 *
 * ── Old schedule endpoints (still work, mapped onto the new model) ────────────────────────────────────
 * GET    /plans/{id}/schedule      A T M  → PlanSchedule   (M: own plans only; days now carry `title`)
 * PUT    /plans/{id}/schedule      A T    PlanSchedule     → PlanSchedule
 *          Sending a day's current workoutId keeps its own workout; any other workoutId copies that workout in.
 *
 * ── Workouts ──────────────────────────────────────────────────────────────────────────────────────────
 * GET    /workouts                 A T M  → PaginatedData<WorkoutResponse>  (library only, day workouts excluded;
 *                                          M: isPublic workouts + ones assigned to them)
 * GET    /workouts/{id}            A T M  → WorkoutResponse  (M: 404 unless public / assigned / in their plan / logged)
 * GET    /workouts/{id}/structure  A T M  → WorkoutStructure (now with workoutExerciseId, setTargets, ownerPlanDayId)
 * PUT    /workouts/{id}/structure  A T    WorkoutStructure → WorkoutStructure
 *          setTargets: ≤ 20 per exercise; reps 0–1000 (min ≤ max), kg 0–1000, rpe 1–10, durationSec 0–36000,
 *          distanceM 0–100000, restSec 0–3600. `sets`/`reps`/`restSeconds` are filled from the targets when omitted.
 * DELETE /workouts/{id}            A T    → null; 409 code WORKOUT_IN_USE (data {planDays, assignments, logs})
 * POST   /workouts/{id}/clone      A T    → WorkoutResponse (now copies the full structure)
 * POST   /workouts/{id}/complete   A T M  CompleteWorkoutRequest → CompleteWorkoutResponse
 *          M: only for themselves (clientId 0/omitted = caller). Persists sets, links the plan day / assignment,
 *          updates personal records. Plan day is inferred from the workout when planAssignmentId is omitted.
 * GET    /workouts/{id}/score?clientId   → WorkoutScore (score/grade now null until scored — no fake 75)
 * REMOVED: POST /workouts/{id}/share; all /workout-builder/* and /workout-automation/* endpoints.
 *
 * ── Member ────────────────────────────────────────────────────────────────────────────────────────────
 * GET    /me/training                              M  → MyTraining (old fields + todayTitle, weekStrip, adherence…)
 * GET    /me/plans/{assignmentId}/calendar?from&to M  → PlanCalendar  (default: the whole plan; max 120 days)
 * POST   /me/plans/{assignmentId}/days/skip        M  DayOverrideRequest {date}         → PlanDayOverride (today or later)
 * POST   /me/plans/{assignmentId}/days/move        M  DayOverrideRequest {date, toDate} → PlanDayOverride
 * DELETE /me/plans/{assignmentId}/days/{date}/override  M → null (undo a skip/move)
 * GET    /me/exercises/{exerciseId}/last           M  → LastPerformance | null
 * GET    /me/exercises/last?ids=1,2,3              M  → LastPerformance[] (exercises never done are omitted; max 50)
 * GET    /me/records?exerciseId                    M  → PersonalRecord[]
 * GET    /me/workout-history?page&pageSize         M  → PaginatedData<WorkoutHistoryItem> (pageSize ≤ 50)
 * GET    /me/workout-history/{logId}               M  → WorkoutHistoryDetail
 */

import type { ApiResponse, PaginatedData } from '../../../api/types';

export type { ApiResponse, PaginatedData };

/** yyyy-MM-dd */
export type DateString = string;
/** ISO-8601 timestamp (UTC) */
export type DateTimeString = string;

/** Assigned | InProgress | Completed | Skipped | Expired (Expired = replaced or ended early) */
export type AssignmentStatus = 'Assigned' | 'InProgress' | 'Completed' | 'Skipped' | 'Expired';
/** Warmup | Main | Cooldown | Circuit | Superset | Dropset | Pyramid | Custom */
export type SectionType = 'Warmup' | 'Main' | 'Cooldown' | 'Circuit' | 'Superset' | 'Dropset' | 'Pyramid' | 'Custom';
export type SetType = 'normal' | 'warmup' | 'drop' | 'failure';
export type RecordType = 'heaviestWeight' | 'estimatedOneRepMax' | 'mostReps' | 'bestSetVolume';
export type CalendarStatus = 'rest' | 'scheduled' | 'done' | 'missed' | 'skipped' | 'moved';
export type StripStatus = CalendarStatus | 'none';

// ─── Plans ──────────────────────────────────────────────────────────────────────────────────────────────

/** Backend enums are numbers in requests: WorkoutGoal 0 WeightLoss,1 MuscleGain,2 Endurance,3 Flexibility,4 General,5 Rehab,6 Sport. */
export type WorkoutGoalValue = 0 | 1 | 2 | 3 | 4 | 5 | 6;
/** Difficulty 0 Beginner, 1 Intermediate, 2 Advanced, 3 Elite. */
export type DifficultyValue = 0 | 1 | 2 | 3;

export interface CreatePlanRequest {
  name: string;
  description?: string | null;
  /** 1–52 */
  durationWeeks: number;
  goal?: WorkoutGoalValue;
  difficulty?: DifficultyValue;
  /** 1–7, display hint */
  daysPerWeekHint?: number | null;
}

export interface UpdatePlanRequest {
  name?: string;
  description?: string;
  /** 1–52 (prefer the week endpoints in the builder) */
  durationWeeks?: number;
  goal?: WorkoutGoalValue;
  difficulty?: DifficultyValue;
  isActive?: boolean;
  /** 0 clears */
  daysPerWeekHint?: number;
}

export interface PlanResponse {
  id: number;
  tenantId: number;
  name: string;
  description: string | null;
  durationWeeks: number;
  /** enum name, e.g. "MuscleGain" */
  goal: string;
  difficulty: string;
  isActive: boolean;
  isTemplate: boolean;
  sourcePlanId: number | null;
  ownerClientId: number | null;
  daysPerWeekHint: number | null;
  createdBy: number;
  createdAt: DateTimeString;
}

export interface PlanAnalyticsResponse {
  planId: number;
  totalAssigned: number;
  completed: number;
  inProgress: number;
  completionRate: number;
}

// ─── Builder ────────────────────────────────────────────────────────────────────────────────────────────

export interface PlanBuilder {
  planId: number;
  name: string;
  description: string | null;
  goal: string;
  difficulty: string;
  durationWeeks: number;
  daysPerWeekHint: number | null;
  /** true = master (library); false = a member's own copy */
  isTemplate: boolean;
  isActive: boolean;
  sourcePlanId: number | null;
  ownerClientId: number | null;
  ownerClientName: string | null;
  createdBy: number;
  /** Whether the caller may edit (false for members, and trainers on others' plans). */
  canEdit: boolean;
  /** Set on a member's copy. */
  clientAssignment: PlanMember | null;
  /** weeks 1…durationWeeks, always present */
  weeks: BuilderWeek[];
}

export interface BuilderWeek {
  weekNumber: number;
  notes: string | null;
  /** Always 7 entries (day 1…7). */
  days: BuilderDay[];
}

export interface BuilderDay {
  /** null until the day is first saved with PUT …/weeks/{w}/days/{d} */
  dayId: number | null;
  weekNumber: number;
  dayNumber: number;
  /** "Push", "Legs"… */
  title: string | null;
  notes: string | null;
  isRestDay: boolean;
  /** The day's workout; edit with PUT /workouts/{workoutId}/structure once ownsWorkout is true. */
  workoutId: number | null;
  workoutName: string | null;
  /** false = older day still pointing at a shared library workout → call PUT day first (copy-on-write). */
  ownsWorkout: boolean;
  sectionCount: number;
  exerciseCount: number;
  /** In order, max 12. */
  exerciseNames: string[];
  /** Has a Superset or Circuit block. */
  hasSuperset: boolean;
  estimatedMinutes: number | null;
}

export interface UpsertPlanDayRequest {
  /** ≤ 100 chars; also renames the day workout */
  title?: string | null;
  /** ≤ 2000 chars */
  notes?: string | null;
  /** true keeps any existing workout but the member sees a rest day */
  isRestDay: boolean;
}

export interface PlanDayRef {
  week: number;
  day: number;
}

export interface CopyDayRequest {
  /** Targets in any week (1…durationWeeks); their content is replaced. */
  targets: PlanDayRef[];
}

export interface FromLibraryRequest {
  workoutId: number;
  /** Append the library workout's blocks instead of replacing the day's. */
  append?: boolean;
}

export interface AddWeekRequest {
  /** Copy this week into the new last week; blank when omitted. */
  copyFrom?: number | null;
}

export interface CopyWeekRequest {
  /** Target weeks (≠ source, 1–52). Weeks past the end extend the plan. */
  toWeeks: number[];
}

export interface DuplicatePlanRequest {
  /** Default "<name> (copy)" */
  name?: string | null;
}

// ─── Assign / members ───────────────────────────────────────────────────────────────────────────────────

export interface AssignPlanRequest {
  memberIds: number[];
  /** Admins: the trainer to record (TrainerProfile id). Trainers always record themselves. */
  trainerId?: number | null;
  /** The calendar date the member starts. */
  startDate: DateString;
  /** Plan position on startDate (default 1/1); e.g. week 2 day 3 → the plan is back-dated. */
  startWeek?: number;
  startDay?: number;
  /** End the member's current active plan (status Expired) instead of 409 PLAN_ALREADY_ACTIVE. */
  replaceExisting?: boolean;
}

/** `data` of the 409 PLAN_ALREADY_ACTIVE answer. */
export interface ActivePlanConflict {
  clientId: number;
  clientName: string | null;
  assignmentId: number;
  planName: string;
  startDate: DateString;
}

export interface Adherence {
  /** Training days done so far */
  completed: number;
  /** Training days scheduled so far (today only once done; skipped/missed count as not done) */
  scheduled: number;
  /** 0–100, null when nothing scheduled yet */
  percent: number | null;
  totalWorkoutDays: number;
  completedWorkoutDays: number;
}

export interface PlanMember {
  assignmentId: number;
  clientId: number;
  clientName: string | null;
  /** The member's own copy (open with /plans/assignments/{assignmentId}/builder or /plans/{planId}/builder). */
  planId: number;
  planName: string | null;
  sourcePlanId: number | null;
  /** Back-dated by the start offset. */
  startDate: DateString;
  endDate: DateString;
  status: AssignmentStatus;
  currentWeek: number | null;
  currentDay: number | null;
  adherence: Adherence | null;
  lastWorkoutAt: DateTimeString | null;
  createdAt: DateTimeString;
}

// ─── Calendar / overrides ───────────────────────────────────────────────────────────────────────────────

export interface CalendarEntry {
  date: DateString;
  weekNumber: number;
  dayNumber: number;
  dayId: number | null;
  /** Day title, else workout name */
  title: string | null;
  isRestDay: boolean;
  workoutId: number | null;
  status: CalendarStatus;
  isToday: boolean;
  /** On the original date of a moved day */
  movedToDate: DateString | null;
  /** On the date a day was moved to (an extra entry for that date) */
  movedFromDate: DateString | null;
  completedLogId: number | null;
}

export interface PlanCalendar {
  assignmentId: number;
  planId: number;
  planName: string;
  durationWeeks: number;
  startDate: DateString;
  endDate: DateString;
  status: AssignmentStatus;
  from: DateString;
  to: DateString;
  adherence: Adherence;
  /** One per date in range, plus extra entries for days moved onto a date. */
  entries: CalendarEntry[];
}

export interface DayOverrideRequest {
  /** The date the plan day is scheduled on (not a rest day, not done). */
  date: DateString;
  /** Move only: start ≤ toDate ≤ end + 7 days (members: today or later). */
  toDate?: DateString;
}

export interface PlanDayOverride {
  id: number;
  assignmentId: number;
  date: DateString;
  action: 'skip' | 'moved';
  movedToDate: DateString | null;
}

// ─── Old schedule (kept) ────────────────────────────────────────────────────────────────────────────────

export interface PlanScheduleDay {
  dayNumber: number;
  workoutId: number | null;
  workoutName: string | null;
  isRestDay: boolean;
  /** New, read-only here */
  title?: string | null;
}

export interface PlanScheduleWeek {
  weekNumber: number;
  notes: string | null;
  days: PlanScheduleDay[];
}

export interface PlanSchedule {
  planId: number;
  planName: string | null;
  durationWeeks: number;
  weeks: PlanScheduleWeek[];
}

// ─── Workout structure ──────────────────────────────────────────────────────────────────────────────────

export interface SetTarget {
  /** Renumbered 1…n on save */
  setNo?: number;
  type?: SetType;
  repsMin?: number | null;
  repsMax?: number | null;
  weightKg?: number | null;
  rpe?: number | null;
  durationSec?: number | null;
  distanceM?: number | null;
  restSec?: number | null;
}

export interface StructureExercise {
  /** Read-only row id; send as sets[].workoutExerciseId when completing. Changes on every save. */
  workoutExerciseId?: number | null;
  exerciseId: number;
  exerciseName?: string | null;
  sets: number | null;
  /** "10", "8-12", "AMRAP"… */
  reps: string | null;
  durationSeconds: number | null;
  restSeconds: number | null;
  tempo?: string | null;
  weightSuggestion?: string | null;
  notes?: string | null;
  /** Optional per-set targets (≤ 20); null = sets/reps/restSeconds apply to every set. */
  setTargets?: SetTarget[] | null;
}

export interface StructureSection {
  name: string | null;
  type: SectionType;
  /** ≥ 1 (circuits/supersets: rounds) */
  rounds: number;
  restSeconds: number | null;
  exercises: StructureExercise[];
}

export interface WorkoutStructure {
  workoutId: number;
  workoutName: string | null;
  /** Read-only: set on a plan day's workout */
  ownerPlanDayId?: number | null;
  /** ≤ 20 sections, ≤ 40 exercises each */
  sections: StructureSection[];
}

export interface WorkoutResponse {
  id: number;
  tenantId: number;
  name: string;
  description: string | null;
  category: string | null;
  goal: string;
  difficulty: string;
  durationMin: number | null;
  isPublic: boolean;
  isAiGenerated: boolean;
  version: number;
  tags: string[];
  createdAt: DateTimeString;
}

export interface WorkoutScore {
  workoutId: number;
  clientId: number;
  /** null until sessions are scored */
  score: number | null;
  grade: 'A' | 'B' | 'C' | 'D' | null;
  scoredAt: DateTimeString;
}

/** `data` of the 409 WORKOUT_IN_USE answer. */
export interface WorkoutInUse {
  planDays: number;
  assignments: number;
  logs: number;
}

// ─── Complete ───────────────────────────────────────────────────────────────────────────────────────────

export interface CompleteSet {
  exerciseId: number;
  /** structure row id, optional */
  workoutExerciseId?: number | null;
  /** 1–50 */
  setNo: number;
  /** default normal; warmup sets never count for records */
  setType?: SetType;
  /** ≤ 1000 */
  reps?: number | null;
  /** 0–1000 */
  weightKg?: number | null;
  /** 0–36000 */
  durationSec?: number | null;
  /** 0–100000 */
  distanceM?: number | null;
  /** 1–10 */
  rpe?: number | null;
  /** default true */
  completed?: boolean;
}

export interface CompleteWorkoutRequest {
  /** 0/omitted = the caller. Members may only send their own id. */
  clientId?: number;
  startedAt: DateTimeString;
  /** > startedAt, ≤ 24 h later */
  endedAt: DateTimeString;
  calories?: number;
  notes?: string;
  moodBefore?: number;
  moodAfter?: number;
  fatigueLevel?: number;
  /** 1–10 */
  sessionRpe?: number;
  /** Direct workout assignment (inferred when omitted; set to Completed). */
  assignmentId?: number;
  /** Plan day (send all three, e.g. from /me/training todayWeekNumber/todayDayNumber; inferred when omitted). */
  planAssignmentId?: number;
  week?: number;
  day?: number;
  /** ≤ 300 */
  sets: CompleteSet[];
}

export interface NewRecord {
  exerciseId: number;
  exerciseName: string | null;
  type: RecordType;
  value: number;
  previousValue: number | null;
  reps: number | null;
  weightKg: number | null;
}

export interface CompleteWorkoutResponse {
  /** = logId (old field) */
  id: number;
  logId: number;
  clientId: number;
  startedAt: DateTimeString;
  endedAt: DateTimeString | null;
  durationMin: number | null;
  score: number | null;
  calories: number | null;
  notes: string | null;
  assignmentId: number | null;
  planAssignmentId: number | null;
  weekNumber: number | null;
  dayNumber: number | null;
  /** Completed sets only; volume = Σ reps × kg */
  summary: { sets: number; exercises: number; volumeKg: number; durationMin: number | null };
  /** Records beaten this session (a first-ever value is stored silently, not listed). */
  newRecords: NewRecord[];
}

// ─── /me/training ───────────────────────────────────────────────────────────────────────────────────────

export interface AssignedWorkout {
  assignmentId: number;
  workoutId: number;
  workoutName: string;
  trainerName: string | null;
  assignedAt: DateString;
  dueDate: DateString | null;
  status: AssignmentStatus;
  notes: string | null;
}

export interface WeekStripDay {
  date: DateString;
  /** Mon, Tue, … */
  weekday: string;
  isToday: boolean;
  /** false before the plan starts / after it ends */
  inPlan: boolean;
  weekNumber: number | null;
  dayNumber: number | null;
  title: string | null;
  isRestDay: boolean;
  workoutId: number | null;
  done: boolean;
  skipped: boolean;
  moved: boolean;
  movedToDate: DateString | null;
  movedFromDate: DateString | null;
  status: StripStatus;
}

export interface AssignedPlan {
  assignmentId: number;
  /** The member's copy */
  planId: number;
  planName: string;
  durationWeeks: number;
  startDate: DateString;
  endDate: DateString;
  status: AssignmentStatus;
  /** Calendar position today (null outside the plan) */
  currentWeek: number | null;
  currentDay: number | null;
  /** Today's workout after skip/move overrides */
  todayWorkoutId: number | null;
  todayWorkoutName: string | null;
  todayIsRest: boolean;
  /** Day title, else workout name */
  todayTitle: string | null;
  /** Plan position of today's workout — send as week/day with /complete */
  todayWeekNumber: number | null;
  todayDayNumber: number | null;
  todayDone: boolean;
  todaySkipped: boolean;
  /** Mon–Sun of this week; empty unless the plan is active */
  weekStrip: WeekStripDay[];
  /** null unless the plan is active */
  adherence: Adherence | null;
}

export interface MyTraining {
  /** The one active plan (also in plans[]) */
  activePlanAssignmentId: number | null;
  workouts: AssignedWorkout[];
  plans: AssignedPlan[];
}

// ─── History / records ──────────────────────────────────────────────────────────────────────────────────

export interface LoggedSet {
  id: number;
  exerciseId: number;
  exerciseName: string | null;
  workoutExerciseId: number | null;
  setNo: number;
  setType: SetType;
  reps: number | null;
  weightKg: number | null;
  rpe: number | null;
  durationSec: number | null;
  distanceM: number | null;
  completed: boolean;
}

export interface LastPerformance {
  exerciseId: number;
  exerciseName: string | null;
  logId: number;
  performedAt: DateTimeString;
  sets: LoggedSet[];
  /** Heaviest completed working set — "Last: 60 kg × 8" */
  bestSet: LoggedSet | null;
}

export interface PersonalRecord {
  exerciseId: number;
  exerciseName: string | null;
  type: RecordType;
  /** kg (heaviestWeight, estimatedOneRepMax), reps (mostReps, bodyweight sets), kg×reps (bestSetVolume) */
  value: number;
  reps: number | null;
  weightKg: number | null;
  achievedAt: DateTimeString;
  workoutLogId: number | null;
}

export interface WorkoutHistoryItem {
  logId: number;
  workoutId: number | null;
  workoutName: string | null;
  startedAt: DateTimeString;
  endedAt: DateTimeString | null;
  durationMin: number | null;
  sessionRpe: number | null;
  sets: number;
  exercises: number;
  volumeKg: number;
  /** Records this session still holds */
  recordCount: number;
  planAssignmentId: number | null;
  weekNumber: number | null;
  dayNumber: number | null;
  notes: string | null;
}

export interface WorkoutHistoryDetail extends WorkoutHistoryItem {
  setLogs: LoggedSet[];
  records: PersonalRecord[];
}

/** Error codes the training endpoints return in the envelope's `code`. */
export type TrainingErrorCode = 'PLAN_ALREADY_ACTIVE' | 'WORKOUT_IN_USE';
