using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Engagement;
using GymManagmentApplication.Application.Workout;
using GymManagmentApplication.Application.WorkoutPlan.Requests;
using GymManagmentApplication.Domain.Entities.Training;
using GymManagmentApplication.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Plan = GymManagmentApplication.Domain.Entities.Training.WorkoutPlan;

namespace GymManagmentApplication.Application.Training;

/// <summary>
/// The weekly plan builder: a plan is weeks × 7 days and every day owns its own workout (a
/// WorkoutTemplate with OwnerPlanDayId), edited with PUT /workouts/{id}/structure. Day and week
/// operations, duplicating a plan, assigning it (each member gets a deep copy), and the old
/// GET/PUT /plans/{id}/schedule mapped onto the same model.
/// <para>
/// Copy-on-write: an older day that still points at a shared library workout gets its own copy the
/// first time the day is changed, so editing a day never changes the library or another plan.
/// </para>
/// </summary>
public class PlanBuilderService(IAppDbContext db, ICurrentUser currentUser, Notifier notifier)
{
    public const byte MaxWeeks = 52;

    /// <summary>Tests: fixes "today" instead of the gym's clock.</summary>
    public DateOnly? TodayOverride { get; set; }

    private async Task<DateOnly> TodayAsync(ulong tenantId) => TodayOverride ?? (await TenantClock.ForAsync(db, tenantId)).Today;

    private ulong Me => currentUser.UserId ?? throw new UnauthorizedAccessException("Please sign in again.");

    // ── Loading ────────────────────────────────────────────────────────────

    private async Task<Plan> PlanAsync(ulong planId) =>
        await db.WorkoutPlans.FirstOrDefaultAsync(p => p.Id == planId) ?? throw new KeyNotFoundException("Plan not found.");

    private async Task<Plan> EditablePlanAsync(ulong planId)
    {
        var plan = await PlanAsync(planId);
        await PlanAccess.EnsureCanEditAsync(db, currentUser, plan);
        return plan;
    }

    /// <summary>The plan's week and day rows, tracked, with lookups that also see rows added in this unit of work.</summary>
    private sealed class PlanRows(Plan plan, List<WorkoutPlanWeek> weeks, List<WorkoutPlanDay> days)
    {
        public Plan Plan { get; } = plan;
        public List<WorkoutPlanWeek> Weeks { get; } = weeks;
        public List<WorkoutPlanDay> Days { get; } = days;
        public HashSet<ulong> Orphans { get; } = [];

        public WorkoutPlanWeek? Week(byte n) => Weeks.FirstOrDefault(w => w.WeekNumber == n);
        public WorkoutPlanDay? Day(byte week, byte day) =>
            Week(week) is { } w ? Days.FirstOrDefault(d => d.WeekId == w.Id && d.DayNumber == day) : null;
        public byte WeekOf(WorkoutPlanDay day) => Weeks.First(w => w.Id == day.WeekId).WeekNumber;
        public void Detach(WorkoutPlanDay day)
        {
            if (day.TemplateId is { } id) Orphans.Add(id);
            day.Template = null;
            day.TemplateId = null;
        }
    }

    private async Task<PlanRows> RowsAsync(Plan plan)
    {
        var weeks = await db.WorkoutPlanWeeks.Where(w => w.PlanId == plan.Id).ToListAsync();
        var weekIds = weeks.Select(w => w.Id).ToList();
        var days = await db.WorkoutPlanDays.Where(d => weekIds.Contains(d.WeekId)).ToListAsync();
        return new PlanRows(plan, weeks, days);
    }

    private WorkoutPlanWeek EnsureWeek(PlanRows rows, byte n)
    {
        if (rows.Week(n) is { } w) return w;
        w = new WorkoutPlanWeek { PlanId = rows.Plan.Id, WeekNumber = n };
        db.WorkoutPlanWeeks.Add(w);
        rows.Weeks.Add(w);
        return w;
    }

    private WorkoutPlanDay EnsureDay(PlanRows rows, byte week, byte day)
    {
        var w = EnsureWeek(rows, week);
        if (rows.Days.FirstOrDefault(d => d.WeekId == w.Id && d.DayNumber == day) is { } existing) return existing;
        var d = new WorkoutPlanDay { WeekId = w.Id, DayNumber = day };
        db.WorkoutPlanDays.Add(d);
        rows.Days.Add(d);
        return d;
    }

    private void RemoveDay(PlanRows rows, WorkoutPlanDay day)
    {
        rows.Detach(day);
        rows.Days.Remove(day);
        db.WorkoutPlanDays.Remove(day);
    }

    /// <summary>Saves, then deletes day workouts the operation left unused.</summary>
    private async Task SaveAsync(PlanRows rows)
    {
        rows.Plan.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        await PlanCopy.PurgeUnusedDayWorkoutsAsync(db, rows.Orphans);
    }

    /// <summary>
    /// The day's own workout: created empty when the day has none, copied when the day still points
    /// at a shared (library or other day's) workout. Returns it and whether it was created now.
    /// </summary>
    private async Task<(WorkoutTemplate Workout, bool Created)> EnsureOwnWorkoutAsync(PlanRows rows, WorkoutPlanDay day)
    {
        var plan = rows.Plan;
        if (day.TemplateId is { } id)
        {
            var current = await db.WorkoutTemplates.FirstOrDefaultAsync(w => w.Id == id);
            if (current is not null && current.OwnerPlanDayId == day.Id) return (current, false);
            if (current is not null)
            {
                var src = (await PlanCopy.LoadWorkoutsAsync(db, [id]))[id];
                var copy = PlanCopy.AddWorkoutCopy(db, src, plan.TenantId, plan.CreatedBy, day.Id, day.Title ?? src.Name);
                day.Template = copy;
                day.TemplateId = copy.Id;
                return (copy, true);
            }
        }
        var fresh = new WorkoutTemplate
        {
            TenantId = plan.TenantId, CreatedBy = plan.CreatedBy, Goal = plan.Goal, Difficulty = plan.Difficulty,
            Name = day.Title ?? $"Week {rows.WeekOf(day)} · Day {day.DayNumber}", OwnerPlanDayId = day.Id,
        };
        db.WorkoutTemplates.Add(fresh);
        day.Template = fresh;
        day.TemplateId = fresh.Id;
        return (fresh, true);
    }

    private static string? Clean(string? s, int max, string field)
    {
        s = string.IsNullOrWhiteSpace(s) ? null : s.Trim();
        if (s is not null && s.Length > max) throw new ArgumentException($"{field} can be at most {max} characters.");
        return s;
    }

    private static void CheckPosition(Plan plan, byte week, byte day)
    {
        if (week < 1 || week > plan.DurationWeeks) throw new ArgumentException($"Week must be between 1 and {plan.DurationWeeks}.");
        if (day is < 1 or > 7) throw new ArgumentException("Day must be between 1 and 7.");
    }

    private async Task<(PlanRows Rows, WorkoutPlanDay Day)> DayAsync(ulong planId, ulong dayId)
    {
        var plan = await EditablePlanAsync(planId);
        var rows = await RowsAsync(plan);
        var day = rows.Days.FirstOrDefault(d => d.Id == dayId) ?? throw new KeyNotFoundException("Plan day not found.");
        return (rows, day);
    }

    // ── Builder view ───────────────────────────────────────────────────────

    public async Task<PlanBuilderDto> GetBuilderAsync(ulong planId)
    {
        var plan = await PlanAsync(planId);
        await PlanAccess.EnsureCanViewAsync(db, currentUser, plan);
        return await BuildAsync(plan);
    }

    /// <summary>Trainer/admin: a member's own plan copy, by assignment (trainers: their clients only).</summary>
    public async Task<PlanBuilderDto> GetClientCopyAsync(ulong assignmentId)
    {
        if (currentUser.IsClient()) throw new UnauthorizedAccessException("Only trainers and staff can open a member's plan here.");
        var a = await db.WorkoutPlanAssignments.FirstOrDefaultAsync(x => x.Id == assignmentId) ?? throw new KeyNotFoundException("Plan assignment not found.");
        await db.EnsureCanActOnAllAsync(currentUser, [a.ClientId]);
        var dto = await BuildAsync(await PlanAsync(a.PlanId));
        dto.CanEdit = !currentUser.IsClient();
        return dto;
    }

    private async Task<PlanBuilderDto> BuildAsync(Plan plan)
    {
        var weeks = await db.WorkoutPlanWeeks.AsNoTracking().Where(w => w.PlanId == plan.Id).ToListAsync();
        var weekIds = weeks.Select(w => w.Id).ToList();
        var days = await db.WorkoutPlanDays.AsNoTracking().Where(d => weekIds.Contains(d.WeekId)).ToListAsync();
        var workoutIds = days.Where(d => d.TemplateId != null).Select(d => d.TemplateId!.Value).Distinct().ToList();
        var workouts = await db.WorkoutTemplates.AsNoTracking().Where(w => workoutIds.Contains(w.Id))
            .Select(w => new { w.Id, w.Name, w.OwnerPlanDayId, w.DurationMin }).ToDictionaryAsync(w => w.Id);
        var sections = await db.WorkoutSections.AsNoTracking().Where(s => workoutIds.Contains(s.TemplateId))
            .Select(s => new { s.Id, s.TemplateId, s.Type, s.Rounds, s.SortOrder }).ToListAsync();
        var sectionIds = sections.Select(s => s.Id).ToList();
        var exercises = await db.WorkoutExercises.AsNoTracking().Where(e => sectionIds.Contains(e.SectionId))
            .Select(e => new { e.SectionId, e.SortOrder, Name = e.Exercise.Name, e.Sets, e.DurationSeconds, e.RestSeconds, e.SetTargets })
            .ToListAsync();

        string? clientName = null;
        if (plan.OwnerClientId is { } client)
            clientName = await db.Users.Where(u => u.Id == client).Select(u => (u.FirstName + " " + u.LastName).Trim()).FirstOrDefaultAsync();
        PlanMemberDto? assignment = null;
        if (!plan.IsTemplate)
        {
            var a = await db.WorkoutPlanAssignments.AsNoTracking().Where(x => x.PlanId == plan.Id).OrderByDescending(x => x.CreatedAt).FirstOrDefaultAsync();
            if (a is not null) assignment = (await MembersAsync([a], plan.TenantId)).FirstOrDefault();
        }

        var dto = new PlanBuilderDto
        {
            PlanId = plan.Id, Name = plan.Name, Description = plan.Description, Goal = plan.Goal.ToString(), Difficulty = plan.Difficulty.ToString(),
            DurationWeeks = plan.DurationWeeks, DaysPerWeekHint = plan.DaysPerWeekHint, IsTemplate = plan.IsTemplate, IsActive = plan.IsActive,
            SourcePlanId = plan.SourcePlanId, OwnerClientId = plan.OwnerClientId, OwnerClientName = clientName, CreatedBy = plan.CreatedBy,
            CanEdit = await PlanAccess.CanEditAsync(db, currentUser, plan), ClientAssignment = assignment,
        };
        for (byte w = 1; w <= plan.DurationWeeks; w++)
        {
            var week = weeks.FirstOrDefault(x => x.WeekNumber == w);
            var weekDto = new BuilderWeekDto { WeekNumber = w, Notes = week?.Notes };
            for (byte d = 1; d <= 7; d++)
            {
                var day = week is null ? null : days.FirstOrDefault(x => x.WeekId == week.Id && x.DayNumber == d);
                var dayDto = new BuilderDayDto { WeekNumber = w, DayNumber = d };
                if (day is not null)
                {
                    dayDto.DayId = day.Id;
                    dayDto.Title = day.Title;
                    dayDto.Notes = day.Notes;
                    dayDto.IsRestDay = day.IsRestDay;
                    if (day.TemplateId is { } wid && workouts.TryGetValue(wid, out var wo))
                    {
                        dayDto.WorkoutId = wid;
                        dayDto.WorkoutName = wo.Name;
                        dayDto.OwnsWorkout = wo.OwnerPlanDayId == day.Id;
                        var secs = sections.Where(s => s.TemplateId == wid).OrderBy(s => s.SortOrder).ToList();
                        var rows = secs.SelectMany(s => exercises.Where(e => e.SectionId == s.Id).OrderBy(e => e.SortOrder)
                            .Select(e => (Section: s, Exercise: e))).ToList();
                        dayDto.SectionCount = secs.Count;
                        dayDto.ExerciseCount = rows.Count;
                        dayDto.ExerciseNames = rows.Select(r => r.Exercise.Name).Take(12).ToList();
                        dayDto.HasSuperset = secs.Any(s => s.Type is SectionType.Superset or SectionType.Circuit);
                        var seconds = rows.Sum(r =>
                        {
                            var sets = r.Exercise.SetTargets?.RootElement is { ValueKind: System.Text.Json.JsonValueKind.Array } arr
                                ? arr.GetArrayLength() : r.Exercise.Sets ?? 1;
                            return Math.Max(1, (int)r.Section.Rounds) * Math.Max(1, sets) * ((r.Exercise.DurationSeconds ?? 40) + (r.Exercise.RestSeconds ?? 60));
                        });
                        dayDto.EstimatedMinutes = rows.Count > 0 ? (int)Math.Ceiling(seconds / 60.0) : wo.DurationMin;
                    }
                }
                weekDto.Days.Add(dayDto);
            }
            dto.Weeks.Add(weekDto);
        }
        return dto;
    }

    private static BuilderDayDto DayOf(PlanBuilderDto plan, byte week, byte day) =>
        plan.Weeks.First(w => w.WeekNumber == week).Days.First(d => d.DayNumber == day);

    // ── Day operations ─────────────────────────────────────────────────────

    /// <summary>
    /// Sets a day's title, notes and rest flag; a training day gets its own workout (created empty,
    /// or copied from the shared one it pointed at). Idempotent: call it before opening the day editor.
    /// </summary>
    public async Task<BuilderDayDto> UpsertDayAsync(ulong planId, byte week, byte dayNumber, UpsertPlanDayRequest request)
    {
        var plan = await EditablePlanAsync(planId);
        CheckPosition(plan, week, dayNumber);
        var title = Clean(request.Title, 100, "Day title");
        var notes = Clean(request.Notes, 2000, "Day notes");
        var rows = await RowsAsync(plan);
        await db.InTransactionAsync(async () =>
        {
            var day = EnsureDay(rows, week, dayNumber);
            day.Title = title;
            day.Notes = notes;
            day.IsRestDay = request.IsRestDay;
            if (!request.IsRestDay)
            {
                var (workout, _) = await EnsureOwnWorkoutAsync(rows, day);
                if (title is not null) workout.Name = title;
            }
            await SaveAsync(rows);
        });
        return DayOf(await BuildAsync(plan), week, dayNumber);
    }

    /// <summary>Copies a day (title, notes, rest flag, a new copy of its workout) onto each target day, replacing what was there.</summary>
    public async Task<PlanBuilderDto> CopyDayAsync(ulong planId, ulong dayId, CopyDayRequest request)
    {
        var (rows, source) = await DayAsync(planId, dayId);
        var plan = rows.Plan;
        var sourceWeek = rows.WeekOf(source);
        var targets = request.Targets.DistinctBy(t => (t.Week, t.Day)).Where(t => !(t.Week == sourceWeek && t.Day == source.DayNumber)).ToList();
        if (targets.Count == 0) throw new ArgumentException("Pick at least one other day to copy to.");
        foreach (var t in targets) CheckPosition(plan, t.Week, t.Day);
        var workouts = source.TemplateId is { } wid ? await PlanCopy.LoadWorkoutsAsync(db, [wid]) : [];
        var snapshot = new WorkoutPlanDay { Title = source.Title, Notes = source.Notes, IsRestDay = source.IsRestDay, TemplateId = source.TemplateId };
        await db.InTransactionAsync(async () =>
        {
            foreach (var t in targets)
            {
                var target = EnsureDay(rows, t.Week, t.Day);
                rows.Detach(target);
                PlanCopy.CopyDayContent(db, workouts, snapshot, target, plan.TenantId, plan.CreatedBy);
            }
            await SaveAsync(rows);
        });
        return await BuildAsync(plan);
    }

    /// <summary>Copies a library workout's blocks into the day (replacing them, or appended).</summary>
    public async Task<BuilderDayDto> FromLibraryAsync(ulong planId, ulong dayId, FromLibraryRequest request)
    {
        var (rows, day) = await DayAsync(planId, dayId);
        var plan = rows.Plan;
        if (!await db.WorkoutTemplates.AnyAsync(w => w.Id == request.WorkoutId)) throw new KeyNotFoundException("Workout not found.");
        var src = (await PlanCopy.LoadWorkoutsAsync(db, [request.WorkoutId]))[request.WorkoutId];
        await db.InTransactionAsync(async () =>
        {
            day.IsRestDay = false;
            if (request.Append && day.TemplateId is not null)
            {
                var (workout, created) = await EnsureOwnWorkoutAsync(rows, day);
                var next = created
                    ? db.ChangeTracker.Entries<WorkoutSection>().Count(e => e.State == EntityState.Added && e.Entity.Template == workout)
                    : (await db.WorkoutSections.Where(s => s.TemplateId == workout.Id).MaxAsync(s => (int?)s.SortOrder) ?? -1) + 1;
                PlanCopy.AddSectionsCopy(db, src, workout, next);
                workout.Version++;
            }
            else
            {
                rows.Detach(day);
                var copy = PlanCopy.AddWorkoutCopy(db, src, plan.TenantId, plan.CreatedBy, day.Id, day.Title ?? src.Name);
                day.Template = copy;
                day.TemplateId = copy.Id;
            }
            day.Title ??= src.Name;
            await SaveAsync(rows);
        });
        return DayOf(await BuildAsync(plan), rows.WeekOf(day), day.DayNumber);
    }

    /// <summary>Empties a day: no workout, title or notes (a rest day for the member).</summary>
    public async Task<BuilderDayDto> ClearDayAsync(ulong planId, ulong dayId)
    {
        var (rows, day) = await DayAsync(planId, dayId);
        rows.Detach(day);
        day.Title = null;
        day.Notes = null;
        day.IsRestDay = false;
        await db.InTransactionAsync(() => SaveAsync(rows));
        return DayOf(await BuildAsync(rows.Plan), rows.WeekOf(day), day.DayNumber);
    }

    // ── Week operations ────────────────────────────────────────────────────

    private async Task<(List<WorkoutPlanDay> Days, Dictionary<ulong, WorkoutTemplate> Workouts, string? Notes)> WeekSourceAsync(Plan plan, byte week)
    {
        var notes = await db.WorkoutPlanWeeks.AsNoTracking().Where(w => w.PlanId == plan.Id && w.WeekNumber == week).Select(w => w.Notes).FirstOrDefaultAsync();
        var days = await db.WorkoutPlanDays.AsNoTracking().Where(d => d.Week.PlanId == plan.Id && d.Week.WeekNumber == week && d.DayNumber >= 1 && d.DayNumber <= 7).ToListAsync();
        var ids = days.Where(d => d.TemplateId != null).Select(d => d.TemplateId!.Value).Distinct().ToList();
        return (days, await PlanCopy.LoadWorkoutsAsync(db, ids), notes);
    }

    /// <summary>Replaces week <paramref name="target"/>'s days with copies of the source week's.</summary>
    private void CopyWeekInto(PlanRows rows, (List<WorkoutPlanDay> Days, Dictionary<ulong, WorkoutTemplate> Workouts, string? Notes) src, byte target)
    {
        var plan = rows.Plan;
        EnsureWeek(rows, target).Notes = src.Notes;
        for (byte d = 1; d <= 7; d++)
        {
            var from = src.Days.FirstOrDefault(x => x.DayNumber == d);
            var existing = rows.Day(target, d);
            if (from is null)
            {
                if (existing is not null) RemoveDay(rows, existing);
                continue;
            }
            var day = existing ?? EnsureDay(rows, target, d);
            rows.Detach(day);
            PlanCopy.CopyDayContent(db, src.Workouts, from, day, plan.TenantId, plan.CreatedBy);
        }
    }

    /// <summary>Adds a week at the end (blank, or a copy of <see cref="AddWeekRequest.CopyFrom"/>).</summary>
    public async Task<PlanBuilderDto> AddWeekAsync(ulong planId, AddWeekRequest request)
    {
        var plan = await EditablePlanAsync(planId);
        if (plan.DurationWeeks >= MaxWeeks) throw new ArgumentException($"A plan can have at most {MaxWeeks} weeks.");
        if (request.CopyFrom is { } from && (from < 1 || from > plan.DurationWeeks))
            throw new ArgumentException($"Week must be between 1 and {plan.DurationWeeks}.");
        var source = request.CopyFrom is { } f ? await WeekSourceAsync(plan, f) : default;
        var rows = await RowsAsync(plan);
        var number = (byte)(plan.DurationWeeks + 1);
        await db.InTransactionAsync(async () =>
        {
            // Rows past the old end (left by an earlier shortening) are replaced.
            foreach (var stale in rows.Days.Where(d => rows.WeekOf(d) == number).ToList()) RemoveDay(rows, stale);
            if (request.CopyFrom is not null) CopyWeekInto(rows, source, number);
            else EnsureWeek(rows, number);
            plan.DurationWeeks = number;
            await SaveAsync(rows);
        });
        return await BuildAsync(plan);
    }

    /// <summary>Copies a week onto other weeks (replacing their days); weeks past the end extend the plan.</summary>
    public async Task<PlanBuilderDto> CopyWeekAsync(ulong planId, byte week, CopyWeekRequest request)
    {
        var plan = await EditablePlanAsync(planId);
        if (week < 1 || week > plan.DurationWeeks) throw new ArgumentException($"Week must be between 1 and {plan.DurationWeeks}.");
        var targets = request.ToWeeks.Distinct().Where(t => t != week).OrderBy(t => t).ToList();
        if (targets.Count == 0) throw new ArgumentException("Pick at least one other week to copy to.");
        if (targets.Any(t => t < 1 || t > MaxWeeks)) throw new ArgumentException($"Weeks must be between 1 and {MaxWeeks}.");
        var source = await WeekSourceAsync(plan, week);
        var rows = await RowsAsync(plan);
        await db.InTransactionAsync(async () =>
        {
            foreach (var t in targets) CopyWeekInto(rows, source, t);
            plan.DurationWeeks = Math.Max(plan.DurationWeeks, targets.Max());
            await SaveAsync(rows);
        });
        return await BuildAsync(plan);
    }

    /// <summary>Deletes a week; later weeks move up one and the plan gets a week shorter.</summary>
    public async Task<PlanBuilderDto> DeleteWeekAsync(ulong planId, byte week)
    {
        var plan = await EditablePlanAsync(planId);
        if (week < 1 || week > plan.DurationWeeks) throw new ArgumentException($"Week must be between 1 and {plan.DurationWeeks}.");
        if (plan.DurationWeeks <= 1) throw new ArgumentException("A plan needs at least one week.");
        var rows = await RowsAsync(plan);
        await db.InTransactionAsync(async () =>
        {
            foreach (var w in rows.Weeks.Where(w => w.WeekNumber == week).ToList())
            {
                foreach (var d in rows.Days.Where(d => d.WeekId == w.Id).ToList()) RemoveDay(rows, d);
                rows.Weeks.Remove(w);
                db.WorkoutPlanWeeks.Remove(w);
            }
            foreach (var w in rows.Weeks.Where(w => w.WeekNumber > week)) w.WeekNumber--;
            plan.DurationWeeks--;
            await SaveAsync(rows);
        });
        return await BuildAsync(plan);
    }

    // ── Whole plan ─────────────────────────────────────────────────────────

    /// <summary>A full deep copy as a new master plan (e.g. a template from a member's copy, or a variation).</summary>
    public async Task<PlanBuilderDto> DuplicateAsync(ulong planId, DuplicatePlanRequest request)
    {
        if (currentUser.IsClient()) throw new UnauthorizedAccessException("Only trainers and staff can duplicate plans.");
        var plan = await PlanAsync(planId);
        await PlanAccess.EnsureCanViewAsync(db, currentUser, plan);
        var name = Clean(request.Name, 200, "Plan name") ?? $"{plan.Name} (copy)";
        var snapshot = await PlanCopy.LoadAsync(db, plan);
        Plan copy = default!;
        await db.InTransactionAsync(async () =>
        {
            copy = PlanCopy.AddPlanCopy(db, snapshot, Me, p => { p.Name = name; p.IsTemplate = true; p.OwnerClientId = null; });
            await db.SaveChangesAsync();
        });
        return await BuildAsync(copy);
    }

    /// <summary>
    /// Assigns the plan: every member gets their own deep copy (IsTemplate = false, OwnerClientId,
    /// SourcePlanId) and a plan assignment pointing at it. A member has one active plan at a time:
    /// without <see cref="AssignPlanRequest.ReplaceExisting"/> an active one answers 409 PLAN_ALREADY_ACTIVE;
    /// with it the old assignment ends (Expired). Start week/day shift StartDate back so that the
    /// member is on that plan day on <see cref="AssignPlanRequest.StartDate"/>.
    /// </summary>
    public async Task<List<PlanMemberDto>> AssignAsync(ulong planId, AssignPlanRequest request)
    {
        if (currentUser.IsClient()) throw new UnauthorizedAccessException("Only trainers and staff can assign plans.");
        var plan = await PlanAsync(planId);
        await PlanAccess.EnsureCanViewAsync(db, currentUser, plan);
        if (!plan.IsActive) throw new ArgumentException("This plan is archived.");
        var memberIds = request.MemberIds.Distinct().ToList();
        if (memberIds.Count == 0) throw new ArgumentException("Pick at least one member.");
        if (request.StartWeek < 1 || request.StartWeek > plan.DurationWeeks) throw new ArgumentException($"Start week must be between 1 and {plan.DurationWeeks}.");
        if (request.StartDay is < 1 or > 7) throw new ArgumentException("Start day must be between 1 and 7.");
        foreach (var memberId in memberIds) await db.EnsureUserAsync(memberId, plan.TenantId);
        await db.EnsureCanActOnAllAsync(currentUser, memberIds); // trainers: assigned clients only
        var trainerId = await db.ResolveAssigningTrainerAsync(currentUser, request.TrainerId);
        var start = request.StartDate.AddDays(-((request.StartWeek - 1) * 7 + request.StartDay - 1));

        var today = await TodayAsync(plan.TenantId);
        var open = await db.WorkoutPlanAssignments.Include(a => a.Plan)
            .Where(a => memberIds.Contains(a.ClientId) && PlanAccess.OpenStatuses.Contains(a.Status)).ToListAsync();
        var active = open.Where(a => a.StartDate.AddDays(a.Plan.DurationWeeks * 7 - 1) >= today).ToList();
        var names = await db.Users.Where(u => memberIds.Contains(u.Id))
            .Select(u => new { u.Id, Name = (u.FirstName + " " + u.LastName).Trim() }).ToDictionaryAsync(u => u.Id, u => u.Name);
        if (active.Count > 0 && !request.ReplaceExisting)
            throw new RuleException(active.Count == 1 && memberIds.Count == 1
                    ? $"This member is already on \"{active[0].Plan.Name}\". Replace it?"
                    : "Some members already have an active plan. Replace their current plans?", RuleException.ConflictStatus)
            {
                Code = "PLAN_ALREADY_ACTIVE",
                Payload = active.Select(a => new ActivePlanConflictDto
                {
                    ClientId = a.ClientId, ClientName = names.GetValueOrDefault(a.ClientId), AssignmentId = a.Id, PlanName = a.Plan.Name, StartDate = a.StartDate,
                }).ToList(),
            };

        var snapshot = await PlanCopy.LoadAsync(db, plan);
        var created = new List<WorkoutPlanAssignment>();
        await db.InTransactionAsync(async () =>
        {
            foreach (var old in active) old.Status = AssignmentStatus.Expired;
            foreach (var memberId in memberIds)
            {
                var copy = PlanCopy.AddPlanCopy(db, snapshot, Me, p => { p.IsTemplate = false; p.OwnerClientId = memberId; p.SourcePlanId = plan.Id; });
                var assignment = new WorkoutPlanAssignment
                {
                    TenantId = plan.TenantId, Plan = copy, PlanId = copy.Id, ClientId = memberId, TrainerId = trainerId,
                    StartDate = start, CreatedAt = DateTime.UtcNow,
                };
                db.WorkoutPlanAssignments.Add(assignment);
                created.Add(assignment);
                notifier.Add(plan.TenantId, memberId, "New training plan",
                    $"{plan.Name} starts {request.StartDate:dd MMM}.", "training", copy.Id);
            }
            await db.SaveChangesAsync();
        });
        return await MembersAsync(created, plan.TenantId);
    }

    /// <summary>Members on this plan (its own assignments and its members' copies), with adherence. Trainers see their clients only.</summary>
    public async Task<List<PlanMemberDto>> GetMembersAsync(ulong planId)
    {
        var plan = await PlanAsync(planId);
        var q = db.WorkoutPlanAssignments.Include(a => a.Plan)
            .Where(a => a.PlanId == plan.Id || (a.Plan.SourcePlanId == plan.Id && !a.Plan.IsTemplate));
        if (currentUser.IsTrainer())
        {
            var mine = db.AssignedClientIds(Me);
            q = q.Where(a => mine.Contains(a.ClientId));
        }
        var list = await q.OrderByDescending(a => a.CreatedAt).Take(500).ToListAsync();
        return await MembersAsync(list, plan.TenantId);
    }

    private async Task<List<PlanMemberDto>> MembersAsync(List<WorkoutPlanAssignment> assignments, ulong tenantId)
    {
        if (assignments.Count == 0) return [];
        var today = await TodayAsync(tenantId);
        var calendars = await PlanCalendar.LoadManyAsync(db, assignments);
        var ids = assignments.Select(a => a.Id).ToList();
        var clientIds = assignments.Select(a => a.ClientId).Distinct().ToList();
        var names = await db.Users.Where(u => clientIds.Contains(u.Id))
            .Select(u => new { u.Id, Name = (u.FirstName + " " + u.LastName).Trim() }).ToDictionaryAsync(u => u.Id, u => u.Name);
        var last = await db.WorkoutLogs.Where(l => l.PlanAssignmentId != null && ids.Contains(l.PlanAssignmentId.Value))
            .GroupBy(l => l.PlanAssignmentId!.Value).Select(g => new { Id = g.Key, At = g.Max(l => l.StartedAt) }).ToDictionaryAsync(x => x.Id, x => x.At);
        var planIds = assignments.Select(a => a.PlanId).Distinct().ToList();
        var sources = await db.WorkoutPlans.Where(p => planIds.Contains(p.Id))
            .Select(p => new { p.Id, p.SourcePlanId }).ToDictionaryAsync(p => p.Id, p => p.SourcePlanId);
        return assignments.Select(a =>
        {
            var cal = calendars.GetValueOrDefault(a.Id);
            var pos = cal?.PositionOn(today);
            return new PlanMemberDto
            {
                AssignmentId = a.Id, ClientId = a.ClientId, ClientName = names.GetValueOrDefault(a.ClientId), PlanId = a.PlanId,
                PlanName = cal?.PlanName, SourcePlanId = sources.GetValueOrDefault(a.PlanId), StartDate = a.StartDate,
                EndDate = cal?.EndDate ?? a.StartDate, Status = a.Status.ToString(), CurrentWeek = pos?.Week, CurrentDay = pos?.Day,
                Adherence = cal?.Adherence(today), LastWorkoutAt = last.TryGetValue(a.Id, out var at) ? at : null, CreatedAt = a.CreatedAt,
            };
        }).ToList();
    }

    // ── Old schedule endpoints (GET/PUT /plans/{id}/schedule) ───────────────

    public async Task<PlanScheduleDto> GetScheduleAsync(ulong planId)
    {
        var p = await PlanAsync(planId);
        await PlanAccess.EnsureCanViewAsync(db, currentUser, p);
        var weeks = await db.WorkoutPlanWeeks.AsNoTracking().Where(w => w.PlanId == planId).OrderBy(w => w.WeekNumber).ToListAsync();
        var weekIds = weeks.Select(w => w.Id).ToList();
        var days = await db.WorkoutPlanDays.AsNoTracking().Include(d => d.Template).Where(d => weekIds.Contains(d.WeekId)).OrderBy(d => d.DayNumber).ToListAsync();
        return new PlanScheduleDto
        {
            PlanId = p.Id, PlanName = p.Name, DurationWeeks = p.DurationWeeks,
            Weeks = weeks.Select(w => new PlanWeekDto
            {
                WeekNumber = w.WeekNumber, Notes = w.Notes,
                Days = days.Where(d => d.WeekId == w.Id).Select(d => new PlanDayDto
                {
                    DayNumber = d.DayNumber, IsRestDay = d.IsRestDay, WorkoutId = d.TemplateId, WorkoutName = d.Template?.Name, Title = d.Title,
                }).ToList(),
            }).ToList(),
        };
    }

    /// <summary>
    /// Replaces the plan's schedule (old editor). A day keeps its own workout when the same id is sent
    /// back; a different (library) workout id is copied into the day. Days without a workout are rest days.
    /// </summary>
    public async Task<PlanScheduleDto> SaveScheduleAsync(ulong planId, PlanScheduleDto request)
    {
        var plan = await EditablePlanAsync(planId);
        if (request.Weeks.Any(w => w.WeekNumber < 1 || w.WeekNumber > plan.DurationWeeks))
            throw new ArgumentException($"Weeks must be between 1 and {plan.DurationWeeks}.");
        if (request.Weeks.SelectMany(w => w.Days).Any(d => d.DayNumber is < 1 or > 7))
            throw new ArgumentException("Days must be between 1 and 7.");
        var workoutIds = request.Weeks.SelectMany(w => w.Days).Where(d => d.WorkoutId is > 0).Select(d => d.WorkoutId!.Value).Distinct().ToList();
        var known = await db.WorkoutTemplates.Where(w => workoutIds.Contains(w.Id)).Select(w => w.Id).ToListAsync();
        if (workoutIds.Except(known).FirstOrDefault() is var missing and > 0)
            throw new ArgumentException($"Workout {missing} isn't in this gym.");

        var rows = await RowsAsync(plan);
        var keepCurrent = rows.Days.Where(d => d.TemplateId != null).Select(d => d.TemplateId!.Value).ToHashSet();
        var library = await PlanCopy.LoadWorkoutsAsync(db, workoutIds.Where(id => !keepCurrent.Contains(id)).ToList());
        await db.InTransactionAsync(async () =>
        {
            var keep = new HashSet<WorkoutPlanDay>();
            var keepWeeks = new HashSet<WorkoutPlanWeek>();
            foreach (var w in request.Weeks.GroupBy(w => w.WeekNumber).Select(g => g.First()))
            {
                var week = EnsureWeek(rows, w.WeekNumber);
                week.Notes = w.Notes?.Trim();
                keepWeeks.Add(week);
                foreach (var d in w.Days.GroupBy(d => d.DayNumber).Select(g => g.First()))
                {
                    var day = EnsureDay(rows, w.WeekNumber, d.DayNumber);
                    keep.Add(day);
                    if (d.WorkoutId is not > 0)
                    {
                        rows.Detach(day);
                        day.IsRestDay = true;
                        continue;
                    }
                    day.IsRestDay = d.IsRestDay;
                    if (day.TemplateId == d.WorkoutId) continue;
                    var src = library.GetValueOrDefault(d.WorkoutId.Value)
                              ?? (await PlanCopy.LoadWorkoutsAsync(db, [d.WorkoutId.Value]))[d.WorkoutId.Value];
                    rows.Detach(day);
                    var copy = PlanCopy.AddWorkoutCopy(db, src, plan.TenantId, plan.CreatedBy, day.Id);
                    day.Template = copy;
                    day.TemplateId = copy.Id;
                    day.Title = null;
                }
            }
            foreach (var day in rows.Days.Where(d => !keep.Contains(d)).ToList()) RemoveDay(rows, day);
            foreach (var week in rows.Weeks.Where(w => !keepWeeks.Contains(w)).ToList())
            {
                rows.Weeks.Remove(week);
                db.WorkoutPlanWeeks.Remove(week);
            }
            await SaveAsync(rows);
        });
        return await GetScheduleAsync(planId);
    }
}
