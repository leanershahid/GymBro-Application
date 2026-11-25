using System.Text.Json;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Workout.Interfaces;
using GymManagmentApplication.Application.Workout.Requests;
using GymManagmentApplication.Application.Workout.Responses;
using GymManagmentApplication.Domain.Entities.Training;
using GymManagmentApplication.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Workout.Services;

public class WorkoutService(IWorkoutRepository repository, ICurrentUser currentUser, IAppDbContext db, GymManagmentApplication.Application.Engagement.Notifier notifier) : IWorkoutService
{
    /// <summary>Tests: fixes today instead of the gym clock (plan day inference on complete).</summary>
    public DateOnly? TodayOverride { get; set; }

    /// <summary>The library (plan day workouts excluded). Members: public workouts plus ones assigned to them.</summary>
    public async Task<PagedResponse<WorkoutResponse>> GetAllAsync(WorkoutListRequest request)
    {
        request.VisibleToMemberId = currentUser.IsClient() ? currentUser.UserId ?? 0 : null;
        var (items, total) = await repository.GetAllAsync(request);
        return new PagedResponse<WorkoutResponse>
        {
            Items = items.Select(Map),
            PageNumber = request.PageNumber,
            PageSize = request.PageSize,
            TotalRecords = total
        };
    }

    public async Task<WorkoutResponse> CreateAsync(ulong userId, CreateWorkoutRequest request)
    {
        var tags = request.Tags is not null
            ? JsonDocument.Parse(JsonSerializer.Serialize(request.Tags))
            : null;

        var template = new WorkoutTemplate
        {
            TenantId = currentUser.ResolveTenantId(request.TenantId),
            CreatedBy = userId,
            Name = request.Name,
            Description = request.Description,
            Category = request.Category,
            Goal = request.Goal,
            Difficulty = request.Difficulty,
            DurationMin = request.DurationMin,
            IsPublic = request.IsPublic,
            Tags = tags
        };
        var created = await repository.CreateAsync(template);
        return Map(created);
    }

    public async Task<WorkoutResponse?> GetByIdAsync(ulong id)
    {
        var w = await repository.GetByIdAsync(id);
        if (w is null) return null;
        if (currentUser.IsClient() && !await Training.PlanAccess.MemberCanSeeWorkoutAsync(db, currentUser.UserId ?? 0, id)) return null;
        return Map(w);
    }

    /// <summary>Trainers may only change workouts they created (a plan day's workout: the plan's rules); admins/staff any in their gym.</summary>
    private Task EnsureCanEdit(WorkoutTemplate w) => Training.PlanAccess.EnsureCanEditWorkoutAsync(db, currentUser, w);

    public async Task<WorkoutResponse?> UpdateAsync(ulong id, UpdateWorkoutRequest request)
    {
        var w = await repository.GetByIdAsync(id);
        if (w is null) return null;
        await EnsureCanEdit(w);
        if (request.Name is not null) w.Name = request.Name;
        if (request.Description is not null) w.Description = request.Description;
        if (request.Category is not null) w.Category = request.Category;
        if (request.Goal.HasValue) w.Goal = request.Goal.Value;
        if (request.Difficulty.HasValue) w.Difficulty = request.Difficulty.Value;
        if (request.DurationMin.HasValue) w.DurationMin = request.DurationMin;
        if (request.IsPublic.HasValue) w.IsPublic = request.IsPublic.Value;
        await repository.UpdateAsync(w);
        return Map(w);
    }

    public async Task<bool> DeleteAsync(ulong id)
    {
        var w = await repository.GetByIdAsync(id);
        if (w is null) return false;
        await EnsureCanEdit(w);
        // Refuse while plans, assignments or history still use it (409 WORKOUT_IN_USE).
        var inPlans = await db.WorkoutPlanDays.CountAsync(d => d.TemplateId == id);
        var assigned = await db.WorkoutAssignments.CountAsync(a => a.TemplateId == id);
        var logged = await db.WorkoutLogs.CountAsync(l => l.TemplateId == id);
        if (inPlans + assigned + logged > 0)
            throw new RuleException("This workout is still used by plans, assignments or workout history, so it can't be deleted. Make it private instead.",
                RuleException.ConflictStatus)
            {
                Code = "WORKOUT_IN_USE",
                Payload = new { planDays = inPlans, assignments = assigned, logs = logged },
            };
        return await repository.DeleteAsync(id);
    }

    /// <summary>A private library copy with the full structure (sections, exercises, set targets).</summary>
    public async Task<WorkoutResponse?> CloneAsync(ulong id, ulong userId)
    {
        if (await repository.GetByIdAsync(id) is null) return null;
        var src = (await Training.PlanCopy.LoadWorkoutsAsync(db, [id]))[id];
        var clone = Training.PlanCopy.AddWorkoutCopy(db, src, src.TenantId, userId, ownerPlanDayId: null, name: $"{src.Name} (Copy)");
        await db.SaveChangesAsync();
        return Map(clone);
    }

    public async Task<List<WorkoutLogResponse>> AssignAsync(AssignWorkoutRequest request)
    {
        // Workout (tenant-filtered) decides the tenant; every member must be in the same gym.
        var workout = await repository.GetByIdAsync(request.WorkoutId)
            ?? throw new KeyNotFoundException($"Workout {request.WorkoutId} not found.");
        var memberIds = request.MemberIds.Distinct().ToList();
        var validMembers = await db.Users
            .Where(u => memberIds.Contains(u.Id) && u.TenantId == workout.TenantId && u.DeletedAt == null)
            .Select(u => u.Id).ToListAsync();
        var invalid = memberIds.Except(validMembers).ToList();
        if (invalid.Count > 0)
            throw new ArgumentException($"Members not found in this gym: {string.Join(", ", invalid)}.");
        await db.EnsureCanActOnAllAsync(currentUser, memberIds); // trainers: assigned clients only
        var trainerId = await db.ResolveAssigningTrainerAsync(currentUser, request.TrainerId);

        var results = new List<WorkoutLogResponse>();
        foreach (var memberId in memberIds)
        {
            var assignment = new WorkoutAssignment
            {
                TenantId = workout.TenantId,
                TrainerId = trainerId,
                ClientId = memberId,
                TemplateId = request.WorkoutId,
                AssignedAt = request.AssignedAt,
                DueDate = request.DueDate,
                Notes = request.Notes
            };
            notifier.Add(workout.TenantId, memberId, "New workout assigned",
                $"{workout.Name}{(request.DueDate is { } due ? $" — due {due:dd MMM}" : "")}.", "training", workout.Id);
            var created = await repository.CreateAssignmentAsync(assignment);
            results.Add(new WorkoutLogResponse { Id = created.Id, ClientId = memberId, StartedAt = DateTime.UtcNow });
        }
        return results;
    }

    public async Task<WorkoutProgressResponse?> GetProgressAsync(ulong id, ulong clientId)
    {
        await EnsureSelfOrStaff(clientId);
        var logs = await repository.GetLogsByWorkoutAndClientAsync(id, clientId);
        var total = logs.Count;
        var completed = logs.Count(l => l.EndedAt.HasValue);
        return new WorkoutProgressResponse
        {
            WorkoutId = id,
            ClientId = clientId,
            TotalSessions = total,
            CompletedSessions = completed,
            CompletionRate = total > 0 ? (double)completed / total * 100 : 0,
            LastCompletedAt = logs.Where(l => l.EndedAt.HasValue).OrderByDescending(l => l.EndedAt).FirstOrDefault()?.EndedAt
        };
    }

    /// <summary>Clients only their own workouts; trainers only their assigned clients'.</summary>
    private Task EnsureSelfOrStaff(ulong clientId) => db.EnsureCanActOnAllAsync(currentUser, [clientId]);

    /// <summary>
    /// Logs a finished session: the log, every set (WorkoutSetLogs), the link to the plan day and/or
    /// direct assignment (Completed), and the member's personal records. Members log only for
    /// themselves; trainers for their clients; staff for anyone in the gym.
    /// </summary>
    public async Task<CompleteWorkoutResponse> CompleteAsync(ulong id, CompleteWorkoutRequest request)
    {
        var clientId = request.ClientId is 0
            ? currentUser.UserId ?? throw new UnauthorizedAccessException("Please sign in again.")
            : request.ClientId;
        if (currentUser.IsClient() && clientId != currentUser.UserId)
            throw new UnauthorizedAccessException("You can only log your own workouts.");
        await EnsureSelfOrStaff(clientId);
        var client = await db.Users.FirstOrDefaultAsync(u => u.Id == clientId && u.DeletedAt == null)
            ?? throw new KeyNotFoundException($"Member {clientId} not found.");
        if (!await db.WorkoutTemplates.AnyAsync(w => w.Id == id)
            || (currentUser.IsClient() && !await Training.PlanAccess.MemberCanSeeWorkoutAsync(db, clientId, id)))
            throw new KeyNotFoundException($"Workout {id} not found.");

        var exerciseIds = request.Sets.Select(s => s.ExerciseId).Distinct().ToList();
        var names = await db.Exercises.Where(e => exerciseIds.Contains(e.Id)).Select(e => new { e.Id, e.Name })
            .ToDictionaryAsync(e => e.Id, e => e.Name);
        if (exerciseIds.FirstOrDefault(x => !names.ContainsKey(x)) is var missing and > 0)
            throw new ArgumentException($"Exercise {missing} isn't in this gym's library.");
        var rowIds = request.Sets.Where(s => s.WorkoutExerciseId is > 0).Select(s => s.WorkoutExerciseId!.Value).Distinct().ToList();
        var validRows = rowIds.Count == 0 ? [] : (await db.WorkoutExercises
            .Where(e => rowIds.Contains(e.Id) && e.Section.TemplateId == id).Select(e => e.Id).ToListAsync()).ToHashSet();

        WorkoutAssignment? assignment;
        if (request.AssignmentId is { } aid)
        {
            assignment = await db.WorkoutAssignments.FirstOrDefaultAsync(a => a.Id == aid && a.ClientId == clientId)
                ?? throw new ArgumentException("That workout assignment isn't for this member.");
            if (assignment.TemplateId != id) throw new ArgumentException("That assignment is for a different workout.");
        }
        else
        {
            assignment = await db.WorkoutAssignments
                .Where(a => a.ClientId == clientId && a.TemplateId == id && Training.PlanAccess.OpenStatuses.Contains(a.Status))
                .OrderBy(a => a.AssignedAt).FirstOrDefaultAsync();
        }

        var today = TodayOverride ?? (await TenantClock.ForAsync(db, client.TenantId)).Today;
        var (plan, week, day) = await ResolvePlanDayAsync(id, clientId, request, today);

        var duration = (short)Math.Round((request.EndedAt - request.StartedAt).TotalMinutes);
        var log = new WorkoutLog
        {
            TenantId = client.TenantId, BranchId = client.BranchId, ClientId = clientId, TemplateId = id,
            AssignmentId = assignment?.Id, PlanAssignmentId = plan?.Id, WeekNumber = week, DayNumber = day, SessionRpe = request.SessionRpe,
            StartedAt = request.StartedAt, EndedAt = request.EndedAt, DurationMin = duration, Calories = request.Calories, Notes = request.Notes,
            MoodBefore = request.MoodBefore, MoodAfter = request.MoodAfter, FatigueLevel = request.FatigueLevel, CreatedAt = DateTime.UtcNow,
        };
        db.WorkoutLogs.Add(log);
        var sets = request.Sets.Select(s =>
        {
            Training.SetTypes.TryParse(s.SetType, out var type);
            return new WorkoutSetLog
            {
                TenantId = client.TenantId, WorkoutLog = log, WorkoutLogId = log.Id, ClientId = clientId, ExerciseId = s.ExerciseId,
                WorkoutExerciseId = s.WorkoutExerciseId is { } row && validRows.Contains(row) ? row : null,
                SetNo = s.SetNo, SetType = type, Reps = s.Reps, WeightKg = s.WeightKg, Rpe = s.Rpe, DurationSec = s.DurationSec,
                DistanceM = s.DistanceM, Completed = s.Completed, PerformedAt = request.EndedAt,
            };
        }).ToList();
        db.WorkoutSetLogs.AddRange(sets);
        if (assignment is not null) assignment.Status = AssignmentStatus.Completed;
        if (plan is { Status: AssignmentStatus.Assigned }) plan.Status = AssignmentStatus.InProgress;
        var records = await Training.PersonalRecords.ApplyAsync(db, client.TenantId, clientId, log, sets, names);
        await db.SaveChangesAsync();

        // Every training day of the plan logged → the plan assignment is completed.
        if (plan is not null && plan.Status != AssignmentStatus.Completed)
        {
            var progress = (await Training.PlanCalendar.LoadAsync(db, plan)).Adherence(today);
            if (progress.TotalWorkoutDays > 0 && progress.CompletedWorkoutDays >= progress.TotalWorkoutDays)
            {
                plan.Status = AssignmentStatus.Completed;
                await db.SaveChangesAsync();
            }
        }

        var done = sets.Where(s => s.Completed).ToList();
        return new CompleteWorkoutResponse
        {
            Id = log.Id, LogId = log.Id, ClientId = clientId, StartedAt = log.StartedAt, EndedAt = log.EndedAt, DurationMin = log.DurationMin,
            Score = log.Score, Calories = log.Calories, Notes = log.Notes, AssignmentId = assignment?.Id, PlanAssignmentId = plan?.Id,
            WeekNumber = week, DayNumber = day,
            Summary = new SessionSummaryResponse
            {
                Sets = done.Count, Exercises = done.Select(s => s.ExerciseId).Distinct().Count(),
                VolumeKg = done.Sum(s => (s.Reps ?? 0) * (s.WeightKg ?? 0)), DurationMin = duration,
            },
            NewRecords = records,
        };
    }

    /// <summary>
    /// The plan day this session was for: as sent (checked), or inferred from the member's open plans
    /// that contain this workout (the not-yet-done day nearest to today).
    /// </summary>
    private async Task<(WorkoutPlanAssignment? Plan, byte? Week, byte? Day)> ResolvePlanDayAsync(
        ulong workoutId, ulong clientId, CompleteWorkoutRequest request, DateOnly today)
    {
        if (request.PlanAssignmentId is { } paId)
        {
            var pa = await db.WorkoutPlanAssignments.FirstOrDefaultAsync(a => a.Id == paId && a.ClientId == clientId)
                ?? throw new ArgumentException("That plan isn't assigned to this member.");
            var cal = await Training.PlanCalendar.LoadAsync(db, pa);
            if (request.Week is { } w && request.Day is { } d)
            {
                if (w > cal.DurationWeeks || cal.SlotAt(w, d).WorkoutId != workoutId)
                    throw new ArgumentException("That plan day has a different workout.");
                return (pa, w, d);
            }
            var pick = Pick(cal, workoutId, today, undoneOnly: true) ?? Pick(cal, workoutId, today, undoneOnly: false)
                ?? throw new ArgumentException("This workout isn't in that plan.");
            return (pa, pick.Week, pick.Day);
        }
        if (request.Week is not null || request.Day is not null)
            throw new ArgumentException("Send planAssignmentId together with week and day.");

        var candidates = await db.WorkoutPlanAssignments
            .Where(a => a.ClientId == clientId && Training.PlanAccess.OpenStatuses.Contains(a.Status)
                        && db.WorkoutPlanDays.Any(d => d.TemplateId == workoutId && d.Week.PlanId == a.PlanId))
            .OrderByDescending(a => a.StartDate).ToListAsync();
        if (candidates.Count == 0) return (null, null, null);
        var calendars = await Training.PlanCalendar.LoadManyAsync(db, candidates);
        foreach (var a in candidates)
            if (calendars.TryGetValue(a.Id, out var cal) && Pick(cal, workoutId, today, undoneOnly: true) is { } p)
                return (a, p.Week, p.Day);
        return (null, null, null);
    }

    private static (byte Week, byte Day)? Pick(Training.PlanCalendar cal, ulong workoutId, DateOnly today, bool undoneOnly) =>
        cal.Slots.Values
            .Where(s => s.WorkoutId == workoutId && !s.IsRest && s.Week <= cal.DurationWeeks && (!undoneOnly || !cal.Done.ContainsKey((s.Week, s.Day))))
            .OrderBy(s => Math.Abs(cal.DateOf(s.Week, s.Day).DayNumber - today.DayNumber))
            .Select(s => ((byte, byte)?)(s.Week, s.Day)).FirstOrDefault();

    public async Task<WorkoutScoreResponse?> GetScoreAsync(ulong id, ulong clientId)
    {
        await EnsureSelfOrStaff(clientId);
        var logs = await repository.GetLogsByWorkoutAndClientAsync(id, clientId);
        var lastLog = logs.OrderByDescending(l => l.CreatedAt).FirstOrDefault();
        if (lastLog is null) return null;
        // No made-up score: null until sessions are actually scored.
        var score = lastLog.Score;
        return new WorkoutScoreResponse
        {
            WorkoutId = id,
            ClientId = clientId,
            Score = score,
            Grade = score is not { } s ? null : s >= 90 ? "A" : s >= 75 ? "B" : s >= 60 ? "C" : "D",
            ScoredAt = lastLog.CreatedAt
        };
    }

    /// <summary>Toggles the user's bookmark on a workout (persisted, ARCH-026). False when the workout is not visible.</summary>
    public async Task<bool> BookmarkAsync(ulong id, ulong userId)
    {
        var tenantId = await db.WorkoutTemplates.Where(w => w.Id == id).Select(w => (ulong?)w.TenantId).FirstOrDefaultAsync();
        if (tenantId is null) return false;

        var existing = await db.WorkoutBookmarks.FirstOrDefaultAsync(b => b.WorkoutTemplateId == id && b.UserId == userId);
        if (existing is not null) db.WorkoutBookmarks.Remove(existing);
        else db.WorkoutBookmarks.Add(new WorkoutBookmark { TenantId = tenantId.Value, UserId = userId, WorkoutTemplateId = id });
        await db.SaveChangesAsync();
        return true;
    }

    private static WorkoutResponse Map(WorkoutTemplate w) => new()
    {
        Id = w.Id,
        TenantId = w.TenantId,
        Name = w.Name,
        Description = w.Description,
        Category = w.Category,
        Goal = w.Goal.ToString(),
        Difficulty = w.Difficulty.ToString(),
        DurationMin = w.DurationMin,
        IsPublic = w.IsPublic,
        IsAiGenerated = w.IsAiGenerated,
        Version = w.Version,
        Tags = w.Tags is not null
            ? w.Tags.RootElement.EnumerateArray().Select(t => t.GetString() ?? "").ToList()
            : [],
        CreatedAt = w.CreatedAt
    };
}
