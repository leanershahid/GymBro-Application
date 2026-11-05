namespace GymManagmentApplication.Domain.Enums;

// Exercises, workouts, trainers and PT sessions.

public enum ExerciseCategory { Strength, Cardio, Flexibility, Balance, Sport, Rehab, Other }
public enum Difficulty { Beginner, Intermediate, Advanced, Elite }
public enum MuscleRole { Primary, Secondary, Stabilizer }
public enum WorkoutGoal { WeightLoss, MuscleGain, Endurance, Flexibility, General, Rehab, Sport }
public enum SectionType { Warmup, Main, Cooldown, Circuit, Superset, Dropset, Pyramid, Custom }
public enum AssignmentStatus { Assigned, InProgress, Completed, Skipped, Expired }
public enum FitnessLevel { Beginner, Intermediate, Advanced, Athlete }
public enum TrainerAssignmentStatus { Active, Inactive, Paused }
public enum PtSessionStatus { Booked, Confirmed, InProgress, Completed, Cancelled, NoShow }
public enum TimeOffStatus { Pending, Approved, Rejected }
public enum AutomationLogStatus { Success, Failed, Skipped }
