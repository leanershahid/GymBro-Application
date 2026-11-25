using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Workout;
using GymManagmentApplication.Domain.Entities.Training;
using GymManagmentApplication.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Training;

// ── DTOs ────────────────────────────────────────────────────────────────────

public class LoggedSetDto
{
    public ulong Id { get; set; }
    public ulong ExerciseId { get; set; }
    public string? ExerciseName { get; set; }
    public ulong? WorkoutExerciseId { get; set; }
    public byte SetNo { get; set; }
    /// <summary>normal | warmup | drop | failure</summary>
    public string SetType { get; set; } = "normal";
    public ushort? Reps { get; set; }
    public decimal? WeightKg { get; set; }
    public decimal? Rpe { get; set; }
    public int? DurationSec { get; set; }
    public decimal? DistanceM { get; set; }
    public bool Completed { get; set; }
}

/// <summary>GET /me/exercises/{id}/last: the member's sets of this exercise in their latest session with it.</summary>
public class LastPerformanceDto
{
    public ulong ExerciseId { get; set; }
    public string? ExerciseName { get; set; }
    public ulong LogId { get; set; }
    public DateTime PerformedAt { get; set; }
    public List<LoggedSetDto> Sets { get; set; } = [];
    /// <summary>Heaviest completed working set (for "Last: 60 kg × 8").</summary>
    public LoggedSetDto? BestSet { get; set; }
}

public class PersonalRecordDto
{
    public ulong ExerciseId { get; set; }
    public string? ExerciseName { get; set; }
    /// <summary>heaviestWeight | estimatedOneRepMax | mostReps | bestSetVolume</summary>
    public string Type { get; set; } = "";
    public decimal Value { get; set; }
    public ushort? Reps { get; set; }
    public decimal? WeightKg { get; set; }
    public DateTime AchievedAt { get; set; }
    public ulong? WorkoutLogId { get; set; }
}

public class WorkoutHistoryItemDto
{
    public ulong LogId { get; set; }
    public ulong? WorkoutId { get; set; }
    public string? WorkoutName { get; set; }
    public DateTime StartedAt { get; set; }
    public DateTime? EndedAt { get; set; }
    public short? DurationMin { get; set; }
    public byte? SessionRpe { get; set; }
    public int Sets { get; set; }
    public int Exercises { get; set; }
    public decimal VolumeKg { get; set; }
    /// <summary>Records this session still holds.</summary>
    public int RecordCount { get; set; }
    public ulong? PlanAssignmentId { get; set; }
    public byte? WeekNumber { get; set; }
    public byte? DayNumber { get; set; }
    public string? Notes { get; set; }
}

public class WorkoutHistoryDetailDto : WorkoutHistoryItemDto
{
    public List<LoggedSetDto> SetLogs { get; set; } = [];
    public List<PersonalRecordDto> Records { get; set; } = [];
}

/// <summary>
/// The member's side of training: /me/training (today, this week's strip, adherence), the plan
/// calendar with skip/move overrides (staff can use the same operations on a member's assignment),
/// previous performance, personal records and workout history.
/// </summary>
public class MemberTrainingService(IAppDbContext db, ICurrentUser currentUser)
{
    public const int MaxCalendarDays = 120;

    /// <summary>Tests: fixes "today" instead of the gym's clock.</summary>
    public DateOnly? TodayOverride { get; set; }

    private ulong Me => currentUser.UserId ?? throw new UnauthorizedAccessException("Please sign in again.");

    private async Task<DateOnly> TodayAsync() => TodayOverride ?? (await TenantClock.ForAsync(db, currentUser.TenantId)).Today;

    // ── /me/training ───────────────────────────────────────────────────────

    public async Task<MyAssignmentsDto> GetMyTrainingAsync()
    {
        var me = Me;
        var today = await TodayAsync();
        var workouts = await db.WorkoutAssignments.AsNoTracking().Include(a => a.Template).Include(a => a.Trainer)
            .Where(a => a.ClientId == me).OrderByDescending(a => a.AssignedAt).Take(50).ToListAsync();
        var plans = await db.WorkoutPlanAssignments.AsNoTracking().Include(a => a.Plan)
            .Where(a => a.ClientId == me).OrderByDescending(a => a.StartDate).Take(20).ToListAsync();

        var result = new MyAssignmentsDto
        {
            Workouts = workouts.Select(a => new AssignedWorkoutDto
            {
                AssignmentId = a.Id, WorkoutId = a.TemplateId, WorkoutName = a.Template.Name,
                TrainerName = a.Trainer?.DisplayName, AssignedAt = a.AssignedAt, DueDate = a.DueDate,
                Status = a.Status.ToString(), Notes = a.Notes,
            }).ToList(),
        };

        var calendars = await PlanCalendar.LoadManyAsync(db, plans);
        foreach (var a in plans)
        {
            var dto = new AssignedPlanDto
            {
                AssignmentId = a.Id, PlanId = a.PlanId, PlanName = a.Plan.Name, DurationWeeks = a.Plan.DurationWeeks,
                StartDate = a.StartDate, Status = a.Status.ToString(), EndDate = a.StartDate.AddDays(a.Plan.DurationWeeks * 7 - 1),
            };
            if (calendars.TryGetValue(a.Id, out var cal))
            {
                if (cal.PositionOn(today) is { } pos)
                {
                    dto.CurrentWeek = pos.Week;
                    dto.CurrentDay = pos.Day;
                }
                // Current plan: not replaced/ended early, and today within its dates (a completed plan still shows its week).
                var open = a.Status is not (AssignmentStatus.Expired or AssignmentStatus.Skipped) && today >= cal.StartDate && today <= cal.LastMoveDate;
                if (dto.CurrentWeek is not null || open)
                {
                    var own = cal.Entries(today, today, today).FirstOrDefault(e => e.MovedFromDate == null);
                    var todays = cal.WorkoutOn(today, today);
                    dto.TodaySkipped = own?.Status == CalendarStatuses.Skipped;
                    dto.TodayIsRest = todays is null;
                    dto.TodayWorkoutId = todays?.WorkoutId;
                    dto.TodayWorkoutName = todays?.WorkoutId is { } wid ? cal.Slots.Values.FirstOrDefault(s => s.WorkoutId == wid)?.WorkoutName : null;
                    dto.TodayTitle = todays?.Title;
                    dto.TodayWeekNumber = todays?.WeekNumber;
                    dto.TodayDayNumber = todays?.DayNumber;
                    dto.TodayDone = todays?.Status == CalendarStatuses.Done;
                }
                if (open)
                {
                    dto.WeekStrip = cal.WeekStrip(PlanCalendar.MondayOf(today), today);
                    dto.Adherence = cal.Adherence(today);
                    result.ActivePlanAssignmentId ??= a.Id;
                }
            }
            result.Plans.Add(dto);
        }
        return result;
    }

    // ── Calendar and overrides (member: own; staff: members they may act on) ─

    private async Task<WorkoutPlanAssignment> AssignmentAsync(ulong assignmentId)
    {
        var a = await db.WorkoutPlanAssignments.FirstOrDefaultAsync(x => x.Id == assignmentId) ?? throw new KeyNotFoundException("Plan not found.");
        if (currentUser.IsClient())
        {
            if (a.ClientId != Me) throw new KeyNotFoundException("Plan not found.");
        }
        else await db.EnsureCanActOnAllAsync(currentUser, [a.ClientId]);
        return a;
    }

    public async Task<PlanCalendarDto> GetCalendarAsync(ulong assignmentId, DateOnly? from, DateOnly? to)
    {
        var a = await AssignmentAsync(assignmentId);
        var cal = await PlanCalendar.LoadAsync(db, a);
        var today = await TodayAsync();
        var start = from ?? cal.StartDate;
        var end = to ?? (from is null ? cal.EndDate : start.AddDays(27));
        if (end < start) throw new ArgumentException("'to' must be on or after 'from'.");
        if (end.DayNumber - start.DayNumber >= MaxCalendarDays) throw new ArgumentException($"Ask for at most {MaxCalendarDays} days at a time.");
        return new PlanCalendarDto
        {
            AssignmentId = a.Id, PlanId = a.PlanId, PlanName = cal.PlanName, DurationWeeks = cal.DurationWeeks,
            StartDate = cal.StartDate, EndDate = cal.EndDate, Status = a.Status.ToString(), From = start, To = end,
            Adherence = cal.Adherence(today), Entries = cal.Entries(start, end, today),
        };
    }

    /// <summary>Skips the plan day scheduled on a date (members: today or later).</summary>
    public Task<PlanDayOverrideDto> SkipAsync(ulong assignmentId, DayOverrideRequest request) =>
        SetOverrideAsync(assignmentId, request.Date, PlanDayOverrideAction.Skip, null);

    /// <summary>Moves the plan day scheduled on a date to another date.</summary>
    public Task<PlanDayOverrideDto> MoveAsync(ulong assignmentId, DayOverrideRequest request) =>
        SetOverrideAsync(assignmentId, request.Date, PlanDayOverrideAction.Moved,
            request.ToDate ?? throw new ArgumentException("Pick the date to move this day to."));

    private async Task<PlanDayOverrideDto> SetOverrideAsync(ulong assignmentId, DateOnly date, PlanDayOverrideAction action, DateOnly? toDate)
    {
        var a = await AssignmentAsync(assignmentId);
        var cal = await PlanCalendar.LoadAsync(db, a);
        var today = await TodayAsync();
        if (cal.PositionOn(date) is not { } pos) throw new ArgumentException("That date isn't part of this plan.");
        var slot = cal.SlotAt(pos.Week, pos.Day);
        if (slot.IsRest) throw new ArgumentException("That's a rest day.");
        if (cal.Done.ContainsKey((pos.Week, pos.Day))) throw new ArgumentException("That workout is already done.");
        if (currentUser.IsClient() && date < today) throw new ArgumentException("You can only change today or later.");
        if (toDate is { } target)
        {
            if (target == date) throw new ArgumentException("Pick a different date.");
            if (currentUser.IsClient() && target < today) throw new ArgumentException("You can only move a day to today or later.");
            if (target < cal.StartDate || target > cal.LastMoveDate)
                throw new ArgumentException($"Pick a date between {cal.StartDate:dd MMM} and {cal.LastMoveDate:dd MMM}.");
        }
        var row = await db.PlanDayOverrides.FirstOrDefaultAsync(o => o.PlanAssignmentId == a.Id && o.Date == date);
        if (row is null)
        {
            row = new PlanDayOverride { TenantId = a.TenantId, PlanAssignmentId = a.Id, Date = date };
            db.PlanDayOverrides.Add(row);
        }
        row.Action = action;
        row.MovedToDate = toDate;
        row.ByUserId = Me;
        row.CreatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return ToDto(row);
    }

    /// <summary>Undoes a skip or move of the day scheduled on a date.</summary>
    public async Task<bool> ClearOverrideAsync(ulong assignmentId, DateOnly date)
    {
        var a = await AssignmentAsync(assignmentId);
        var row = await db.PlanDayOverrides.FirstOrDefaultAsync(o => o.PlanAssignmentId == a.Id && o.Date == date);
        if (row is null) return false;
        if (currentUser.IsClient() && date < await TodayAsync()) throw new ArgumentException("You can only change today or later.");
        db.PlanDayOverrides.Remove(row);
        await db.SaveChangesAsync();
        return true;
    }

    private static PlanDayOverrideDto ToDto(PlanDayOverride o) => new()
    {
        Id = o.Id, AssignmentId = o.PlanAssignmentId, Date = o.Date, MovedToDate = o.MovedToDate,
        Action = o.Action == PlanDayOverrideAction.Skip ? "skip" : "moved",
    };

    // ── Previous performance, records, history ─────────────────────────────

    private static LoggedSetDto Set(WorkoutSetLog s, string? name) => new()
    {
        Id = s.Id, ExerciseId = s.ExerciseId, ExerciseName = name, WorkoutExerciseId = s.WorkoutExerciseId, SetNo = s.SetNo,
        SetType = SetTypes.Name(s.SetType), Reps = s.Reps, WeightKg = s.WeightKg, Rpe = s.Rpe, DurationSec = s.DurationSec,
        DistanceM = s.DistanceM, Completed = s.Completed,
    };

    /// <summary>The member's sets of an exercise from their latest session that included it (null when never done).</summary>
    public async Task<LastPerformanceDto?> GetLastAsync(ulong exerciseId)
    {
        var me = Me;
        var latest = await db.WorkoutSetLogs.Where(s => s.ClientId == me && s.ExerciseId == exerciseId && s.Completed)
            .OrderByDescending(s => s.PerformedAt)
            .Select(s => new { s.WorkoutLogId, s.PerformedAt }).FirstOrDefaultAsync();
        if (latest is null) return null;
        var name = await db.Exercises.Where(e => e.Id == exerciseId).Select(e => e.Name).FirstOrDefaultAsync();
        var sets = await db.WorkoutSetLogs.AsNoTracking()
            .Where(s => s.WorkoutLogId == latest.WorkoutLogId && s.ExerciseId == exerciseId && s.ClientId == me)
            .OrderBy(s => s.SetNo).ToListAsync();
        var dtos = sets.Select(s => Set(s, name)).ToList();
        return new LastPerformanceDto
        {
            ExerciseId = exerciseId, ExerciseName = name, LogId = latest.WorkoutLogId, PerformedAt = latest.PerformedAt, Sets = dtos,
            BestSet = dtos.Where(s => s.Completed && s.SetType != "warmup")
                .OrderByDescending(s => s.WeightKg ?? 0).ThenByDescending(s => s.Reps ?? 0).FirstOrDefault(),
        };
    }

    /// <summary>Last performance for several exercises at once (player pre-fill). Exercises never done are left out.</summary>
    public async Task<List<LastPerformanceDto>> GetLastManyAsync(IEnumerable<ulong> exerciseIds)
    {
        var ids = exerciseIds.Distinct().Take(50).ToList();
        var result = new List<LastPerformanceDto>();
        foreach (var id in ids)
            if (await GetLastAsync(id) is { } last) result.Add(last);
        return result;
    }

    public async Task<List<PersonalRecordDto>> GetRecordsAsync(ulong? exerciseId)
    {
        var me = Me;
        var q = db.PersonalRecords.AsNoTracking().Where(r => r.ClientId == me);
        if (exerciseId is { } ex) q = q.Where(r => r.ExerciseId == ex);
        var rows = await q.Select(r => new { r, Name = r.Exercise.Name }).ToListAsync();
        return rows.OrderBy(x => x.Name).ThenBy(x => x.r.Type).Select(x => Record(x.r, x.Name)).ToList();
    }

    private static PersonalRecordDto Record(PersonalRecord r, string? name) => new()
    {
        ExerciseId = r.ExerciseId, ExerciseName = name, Type = RecordTypes.Name(r.Type), Value = r.Value, Reps = r.Reps,
        WeightKg = r.WeightKg, AchievedAt = r.AchievedAt, WorkoutLogId = r.WorkoutLogId,
    };

    public async Task<PagedResponse<WorkoutHistoryItemDto>> GetHistoryAsync(int page, int pageSize)
    {
        var me = Me;
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 50);
        var q = db.WorkoutLogs.AsNoTracking().Where(l => l.ClientId == me);
        var total = await q.CountAsync();
        var logs = await q.OrderByDescending(l => l.StartedAt).ThenByDescending(l => l.CreatedAt).Page(page, pageSize)
            .Select(l => new { l, Name = l.Template != null ? l.Template.Name : null }).ToListAsync();
        var ids = logs.Select(x => x.l.Id).ToList();
        var stats = await StatsAsync(ids);
        return new PagedResponse<WorkoutHistoryItemDto>
        {
            Items = logs.Select(x => Fill(new WorkoutHistoryItemDto(), x.l, x.Name, stats)).ToList(),
            PageNumber = page, PageSize = pageSize, TotalRecords = total,
        };
    }

    public async Task<WorkoutHistoryDetailDto> GetHistoryItemAsync(ulong logId)
    {
        var me = Me;
        var row = await db.WorkoutLogs.AsNoTracking().Where(l => l.Id == logId && l.ClientId == me)
            .Select(l => new { l, Name = l.Template != null ? l.Template.Name : null }).FirstOrDefaultAsync()
            ?? throw new KeyNotFoundException("Workout not found.");
        var dto = Fill(new WorkoutHistoryDetailDto(), row.l, row.Name, await StatsAsync([logId]));
        var sets = await db.WorkoutSetLogs.AsNoTracking().Where(s => s.WorkoutLogId == logId)
            .Select(s => new { s, Name = s.Exercise.Name }).ToListAsync();
        dto.SetLogs = sets.OrderBy(x => x.s.Id).Select(x => Set(x.s, x.Name)).ToList();
        var records = await db.PersonalRecords.AsNoTracking().Where(r => r.WorkoutLogId == logId && r.ClientId == me)
            .Select(r => new { r, Name = r.Exercise.Name }).ToListAsync();
        dto.Records = records.Select(x => Record(x.r, x.Name)).ToList();
        return dto;
    }

    private sealed record LogStats(int Sets, int Exercises, decimal Volume, int Records);

    private async Task<Dictionary<ulong, LogStats>> StatsAsync(List<ulong> logIds)
    {
        var sets = await db.WorkoutSetLogs.AsNoTracking().Where(s => logIds.Contains(s.WorkoutLogId) && s.Completed)
            .Select(s => new { s.WorkoutLogId, s.ExerciseId, s.Reps, s.WeightKg }).ToListAsync();
        var records = await db.PersonalRecords.AsNoTracking().Where(r => r.WorkoutLogId != null && logIds.Contains(r.WorkoutLogId.Value))
            .Select(r => r.WorkoutLogId!.Value).ToListAsync();
        return logIds.ToDictionary(id => id, id =>
        {
            var mine = sets.Where(s => s.WorkoutLogId == id).ToList();
            return new LogStats(mine.Count, mine.Select(s => s.ExerciseId).Distinct().Count(),
                mine.Sum(s => (s.Reps ?? 0) * (s.WeightKg ?? 0)), records.Count(r => r == id));
        });
    }

    private static T Fill<T>(T dto, WorkoutLog l, string? name, Dictionary<ulong, LogStats> stats) where T : WorkoutHistoryItemDto
    {
        var s = stats.GetValueOrDefault(l.Id) ?? new LogStats(0, 0, 0, 0);
        dto.LogId = l.Id; dto.WorkoutId = l.TemplateId; dto.WorkoutName = name; dto.StartedAt = l.StartedAt; dto.EndedAt = l.EndedAt;
        dto.DurationMin = l.DurationMin; dto.SessionRpe = l.SessionRpe; dto.Sets = s.Sets; dto.Exercises = s.Exercises;
        dto.VolumeKg = s.Volume; dto.RecordCount = s.Records; dto.PlanAssignmentId = l.PlanAssignmentId; dto.WeekNumber = l.WeekNumber;
        dto.DayNumber = l.DayNumber; dto.Notes = l.Notes;
        return dto;
    }
}
