using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Domain.Entities.Training;
using GymManagmentApplication.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Training;

/// <summary>One plan day as scheduled (week/day position, what it holds).</summary>
public sealed record PlanSlot(byte Week, byte Day, ulong? DayId, string? Title, bool IsRestDay, ulong? WorkoutId, string? WorkoutName)
{
    /// <summary>A day with no workout (or marked rest) is a rest day for the member.</summary>
    public bool IsRest => IsRestDay || WorkoutId is null;
    public string? DisplayTitle => Title ?? WorkoutName;
}

/// <summary>
/// Everything needed to map calendar dates to plan days for one plan assignment: the plan's days,
/// the skip/move overrides and which plan days were logged. Plan day N of week W falls on
/// StartDate + (W-1)*7 + (N-1); an override can skip that date or move its day to another date.
/// </summary>
public sealed class PlanCalendar
{
    public WorkoutPlanAssignment Assignment { get; private init; } = default!;
    public string PlanName { get; private init; } = "";
    public byte DurationWeeks { get; private init; }
    public Dictionary<(byte Week, byte Day), PlanSlot> Slots { get; private init; } = [];
    public List<PlanDayOverride> Overrides { get; private init; } = [];
    /// <summary>(week, day) → the latest log for that plan day.</summary>
    public Dictionary<(byte Week, byte Day), (ulong LogId, DateTime At)> Done { get; private init; } = [];

    public DateOnly StartDate => Assignment.StartDate;
    public DateOnly EndDate => StartDate.AddDays(DurationWeeks * 7 - 1);
    /// <summary>A moved day may land up to a week after the plan's last day.</summary>
    public DateOnly LastMoveDate => EndDate.AddDays(7);

    /// <summary>Loads calendars for several assignments with a fixed number of queries.</summary>
    public static async Task<Dictionary<ulong, PlanCalendar>> LoadManyAsync(IAppDbContext db, IReadOnlyCollection<WorkoutPlanAssignment> assignments)
    {
        var result = new Dictionary<ulong, PlanCalendar>();
        if (assignments.Count == 0) return result;
        var planIds = assignments.Select(a => a.PlanId).Distinct().ToList();
        var assignmentIds = assignments.Select(a => a.Id).ToList();

        var plans = await db.WorkoutPlans.AsNoTracking().Where(p => planIds.Contains(p.Id))
            .Select(p => new { p.Id, p.Name, p.DurationWeeks }).ToDictionaryAsync(p => p.Id);
        var rows = await db.WorkoutPlanDays.AsNoTracking().Where(d => planIds.Contains(d.Week.PlanId))
            .Select(d => new
            {
                d.Week.PlanId, d.Week.WeekNumber, d.DayNumber, d.Id, d.Title, d.IsRestDay, d.TemplateId,
                WorkoutName = d.Template != null ? d.Template.Name : null,
            }).ToListAsync();
        var overrides = await db.PlanDayOverrides.AsNoTracking().Where(o => assignmentIds.Contains(o.PlanAssignmentId)).ToListAsync();
        var logs = await db.WorkoutLogs.AsNoTracking()
            .Where(l => l.PlanAssignmentId != null && assignmentIds.Contains(l.PlanAssignmentId.Value) && l.WeekNumber != null && l.DayNumber != null)
            .Select(l => new { l.Id, l.PlanAssignmentId, l.WeekNumber, l.DayNumber, l.StartedAt }).ToListAsync();

        foreach (var a in assignments)
        {
            if (!plans.TryGetValue(a.PlanId, out var plan)) continue;
            var slots = new Dictionary<(byte, byte), PlanSlot>();
            foreach (var r in rows.Where(r => r.PlanId == a.PlanId))
                slots[(r.WeekNumber, r.DayNumber)] = new PlanSlot(r.WeekNumber, r.DayNumber, r.Id, r.Title, r.IsRestDay, r.TemplateId, r.WorkoutName);
            var done = new Dictionary<(byte, byte), (ulong, DateTime)>();
            foreach (var l in logs.Where(l => l.PlanAssignmentId == a.Id).OrderBy(l => l.StartedAt))
                done[(l.WeekNumber!.Value, l.DayNumber!.Value)] = (l.Id, l.StartedAt);
            result[a.Id] = new PlanCalendar
            {
                Assignment = a, PlanName = plan.Name, DurationWeeks = plan.DurationWeeks, Slots = slots,
                Overrides = overrides.Where(o => o.PlanAssignmentId == a.Id).ToList(), Done = done,
            };
        }
        return result;
    }

    public static async Task<PlanCalendar> LoadAsync(IAppDbContext db, WorkoutPlanAssignment assignment) =>
        (await LoadManyAsync(db, [assignment])).GetValueOrDefault(assignment.Id) ?? throw new KeyNotFoundException("Plan not found.");

    /// <summary>The plan position scheduled on a date (ignoring overrides), or null outside the plan.</summary>
    public (byte Week, byte Day)? PositionOn(DateOnly date)
    {
        var index = date.DayNumber - StartDate.DayNumber;
        if (index < 0 || index >= DurationWeeks * 7) return null;
        return ((byte)(index / 7 + 1), (byte)(index % 7 + 1));
    }

    public DateOnly DateOf(byte week, byte day) => StartDate.AddDays((week - 1) * 7 + day - 1);

    public PlanSlot SlotAt(byte week, byte day) =>
        Slots.GetValueOrDefault((week, day)) ?? new PlanSlot(week, day, null, null, false, null, null);

    /// <summary>Calendar entries for every date in the range (a date can have its own day plus days moved onto it).</summary>
    public List<CalendarEntryDto> Entries(DateOnly from, DateOnly to, DateOnly today)
    {
        var list = new List<CalendarEntryDto>();
        var byDate = Overrides.ToDictionary(o => o.Date);
        for (var date = from; date <= to; date = date.AddDays(1))
        {
            if (PositionOn(date) is { } pos)
            {
                var slot = SlotAt(pos.Week, pos.Day);
                var entry = Entry(slot, date, today);
                if (byDate.TryGetValue(date, out var o) && !slot.IsRest && entry.Status != CalendarStatuses.Done)
                {
                    if (o.Action == PlanDayOverrideAction.Skip) entry.Status = CalendarStatuses.Skipped;
                    else { entry.Status = CalendarStatuses.Moved; entry.MovedToDate = o.MovedToDate; }
                }
                list.Add(entry);
            }
            foreach (var o in Overrides.Where(o => o.Action == PlanDayOverrideAction.Moved && o.MovedToDate == date))
            {
                if (PositionOn(o.Date) is not { } src) continue;
                var slot = SlotAt(src.Week, src.Day);
                if (slot.IsRest) continue;
                var entry = Entry(slot, date, today);
                entry.MovedFromDate = o.Date;
                list.Add(entry);
            }
        }
        return list;
    }

    private CalendarEntryDto Entry(PlanSlot slot, DateOnly date, DateOnly today)
    {
        var done = Done.TryGetValue((slot.Week, slot.Day), out var log);
        return new CalendarEntryDto
        {
            Date = date, WeekNumber = slot.Week, DayNumber = slot.Day, DayId = slot.DayId, Title = slot.DisplayTitle,
            IsRestDay = slot.IsRest, WorkoutId = slot.IsRest ? null : slot.WorkoutId, IsToday = date == today,
            CompletedLogId = done ? log.LogId : null,
            Status = slot.IsRest ? CalendarStatuses.Rest
                : done ? CalendarStatuses.Done
                : date < today ? CalendarStatuses.Missed
                : CalendarStatuses.Scheduled,
        };
    }

    /// <summary>
    /// Completed ÷ scheduled so far: training days from the assignment date (not a back-dated start)
    /// up to today. Today counts only once done; skipped and missed days count as not done.
    /// </summary>
    public AdherenceDto Adherence(DateOnly today)
    {
        var from = DateOnly.FromDateTime(Assignment.CreatedAt);
        if (from < StartDate) from = StartDate;
        var to = today < LastMoveDate ? today : LastMoveDate;
        var scheduled = 0;
        var completed = 0;
        if (from <= to)
        {
            foreach (var e in Entries(from, to, today))
            {
                if (e.IsRestDay || e.Status == CalendarStatuses.Moved) continue;
                var isDone = e.Status == CalendarStatuses.Done;
                if (e.Date == today && !isDone) continue;
                scheduled++;
                if (isDone) completed++;
            }
        }
        return new AdherenceDto
        {
            Completed = completed, Scheduled = scheduled,
            Percent = scheduled == 0 ? null : (int)Math.Round(100.0 * completed / scheduled),
            TotalWorkoutDays = Slots.Values.Count(s => !s.IsRest && s.Week <= DurationWeeks),
            CompletedWorkoutDays = Done.Keys.Count(k => Slots.TryGetValue(k, out var s) && !s.IsRest),
        };
    }

    /// <summary>
    /// What the member trains on a date: a day moved onto it first, else the date's own day unless it
    /// was skipped or moved away. Null when nothing is scheduled.
    /// </summary>
    public CalendarEntryDto? WorkoutOn(DateOnly date, DateOnly today)
    {
        var entries = Entries(date, date, today);
        return entries.FirstOrDefault(e => e.MovedFromDate != null && !e.IsRestDay)
               ?? entries.FirstOrDefault(e => e.MovedFromDate == null && !e.IsRestDay
                                              && e.Status is not (CalendarStatuses.Skipped or CalendarStatuses.Moved));
    }

    /// <summary>One strip cell per date (Mon–Sun): the date's workout, else its own (rest / skipped / moved) entry.</summary>
    public List<WeekStripDayDto> WeekStrip(DateOnly monday, DateOnly today)
    {
        var entries = Entries(monday, monday.AddDays(6), today);
        var strip = new List<WeekStripDayDto>();
        for (var i = 0; i < 7; i++)
        {
            var date = monday.AddDays(i);
            var own = entries.FirstOrDefault(e => e.Date == date && e.MovedFromDate == null);
            var pick = WorkoutOn(date, today) ?? own;
            strip.Add(new WeekStripDayDto
            {
                Date = date, Weekday = date.DayOfWeek.ToString()[..3], IsToday = date == today, InPlan = own is not null,
                WeekNumber = pick?.WeekNumber, DayNumber = pick?.DayNumber, Title = pick?.Title,
                IsRestDay = pick is null || pick.IsRestDay, WorkoutId = pick?.WorkoutId,
                Done = pick?.Status == CalendarStatuses.Done,
                Skipped = own?.Status == CalendarStatuses.Skipped,
                Moved = own?.Status == CalendarStatuses.Moved, MovedToDate = own?.MovedToDate, MovedFromDate = pick?.MovedFromDate,
                Status = pick?.Status ?? CalendarStatuses.None,
            });
        }
        return strip;
    }

    public static DateOnly MondayOf(DateOnly date) => date.AddDays(-(((int)date.DayOfWeek + 6) % 7));
}

public static class CalendarStatuses
{
    public const string Rest = "rest";
    public const string Scheduled = "scheduled";
    public const string Done = "done";
    public const string Missed = "missed";
    public const string Skipped = "skipped";
    public const string Moved = "moved";
    /// <summary>Outside the plan.</summary>
    public const string None = "none";
}

public class CalendarEntryDto
{
    public DateOnly Date { get; set; }
    public byte WeekNumber { get; set; }
    public byte DayNumber { get; set; }
    public ulong? DayId { get; set; }
    public string? Title { get; set; }
    public bool IsRestDay { get; set; }
    public ulong? WorkoutId { get; set; }
    /// <summary>rest | scheduled | done | missed | skipped | moved</summary>
    public string Status { get; set; } = CalendarStatuses.Scheduled;
    public bool IsToday { get; set; }
    /// <summary>Set on the original date of a moved day.</summary>
    public DateOnly? MovedToDate { get; set; }
    /// <summary>Set on the date a day was moved to.</summary>
    public DateOnly? MovedFromDate { get; set; }
    public ulong? CompletedLogId { get; set; }
}

public class WeekStripDayDto
{
    public DateOnly Date { get; set; }
    /// <summary>Mon, Tue, …</summary>
    public string Weekday { get; set; } = "";
    public bool IsToday { get; set; }
    /// <summary>False before the plan starts / after it ends.</summary>
    public bool InPlan { get; set; }
    public byte? WeekNumber { get; set; }
    public byte? DayNumber { get; set; }
    public string? Title { get; set; }
    public bool IsRestDay { get; set; }
    public ulong? WorkoutId { get; set; }
    public bool Done { get; set; }
    public bool Skipped { get; set; }
    public bool Moved { get; set; }
    public DateOnly? MovedToDate { get; set; }
    public DateOnly? MovedFromDate { get; set; }
    /// <summary>rest | scheduled | done | missed | skipped | moved | none</summary>
    public string Status { get; set; } = CalendarStatuses.None;
}

public class AdherenceDto
{
    public int Completed { get; set; }
    public int Scheduled { get; set; }
    /// <summary>0–100, null until something was scheduled.</summary>
    public int? Percent { get; set; }
    public int TotalWorkoutDays { get; set; }
    public int CompletedWorkoutDays { get; set; }
}
