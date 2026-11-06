using System.Globalization;
using System.Text.Json;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Domain.Entities.Core;
using GymManagmentApplication.Domain.Entities.Operations;
using GymManagmentApplication.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Operations;

/// <summary>
/// Branch opening hours (regular week + dated exceptions), the member-facing branch info and the
/// gym's operations settings. Times are stored and edited in the branch's time zone
/// (<see cref="Branch.Timezone"/>; a branch still on the "UTC" default uses the gym's zone).
/// </summary>
public class OpeningHoursService(IAppDbContext db, ICurrentUser currentUser, ServiceStatusService statuses)
{
    public const string SettingKey = "operations";
    private const int MaxIntervalsPerDay = 6;
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private static readonly DayOfWeek[] MondayFirst =
        [DayOfWeek.Monday, DayOfWeek.Tuesday, DayOfWeek.Wednesday, DayOfWeek.Thursday, DayOfWeek.Friday, DayOfWeek.Saturday, DayOfWeek.Sunday];

    // ── Loading ──────────────────────────────────────────────────────────────

    private async Task<Domain.Entities.Core.Branch> BranchAsync(ulong branchId) =>
        await db.Branches.FirstOrDefaultAsync(b => b.Id == branchId)
        ?? throw new KeyNotFoundException("Branch not found.");

    /// <summary>The branch's zone; the gym's when the branch was left on the "UTC" default.</summary>
    public async Task<TimeZoneInfo> ZoneForAsync(Domain.Entities.Core.Branch branch)
    {
        if (!string.IsNullOrWhiteSpace(branch.Timezone) && !branch.Timezone.Equals("UTC", StringComparison.OrdinalIgnoreCase))
            return TenantClock.Resolve(branch.Timezone);
        return (await TenantClock.ForAsync(db, branch.TenantId)).Zone;
    }

    /// <summary>Calculator for one branch (tenant passed explicitly so background callers work too).</summary>
    public async Task<OpeningHoursCalculator> CalculatorAsync(Domain.Entities.Core.Branch branch)
    {
        var zone = await ZoneForAsync(branch);
        var weekly = await db.BranchOpeningIntervals.IgnoreQueryFilters()
            .Where(i => i.TenantId == branch.TenantId && i.BranchId == branch.Id)
            .Select(i => new { i.DayOfWeek, i.OpensAt, i.ClosesAt }).ToListAsync();
        var from = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-2);
        var exceptions = await db.BranchHoursExceptions.IgnoreQueryFilters()
            .Where(e => e.TenantId == branch.TenantId && e.BranchId == branch.Id && e.Date >= from)
            .ToListAsync();
        return new OpeningHoursCalculator(zone,
            weekly.Select(w => (w.DayOfWeek, new LocalInterval(w.OpensAt, w.ClosesAt))),
            exceptions.Select(ToDay));
    }

    private static HoursExceptionDay ToDay(BranchHoursException e) =>
        new(e.Date, e.IsClosed, e.IsClosed ? [] : OpeningHoursCalculator.ParseIntervals(e.Intervals), e.Note);

    // ── Member: hours, branch info, directory ────────────────────────────────

    public async Task<BranchHoursResponse> GetHoursAsync(ulong branchId)
    {
        var branch = await BranchAsync(branchId);
        return await HoursFor(branch, DateTime.UtcNow);
    }

    private async Task<BranchHoursResponse> HoursFor(Domain.Entities.Core.Branch branch, DateTime nowUtc)
    {
        var calc = await CalculatorAsync(branch);
        return new BranchHoursResponse
        {
            BranchId = branch.Id, BranchName = branch.Name, Timezone = (await ZoneForAsync(branch)).Id,
            HasHours = calc.HasAnyHours,
            Today = Map(calc.StatusAt(nowUtc)),
            Days = calc.NextDays(nowUtc).Select(d => new HoursDayDto
            {
                Date = d.Date, DayLabel = d.DayLabel, IsClosed = d.IsClosed, Intervals = d.Intervals,
                Note = d.Note, IsException = d.IsException, IsToday = d.IsToday,
            }).ToList(),
        };
    }

    public static OpenStatusDto Map(OpenStatus s) => new()
    {
        IsOpen = s.IsOpen, State = s.State, Label = s.Label, ClosesAt = s.ClosesAtUtc, OpensAt = s.OpensAtUtc, Note = s.Note,
    };

    public async Task<BranchInfoResponse> GetBranchInfoAsync(ulong branchId)
    {
        var b = await BranchAsync(branchId);
        var profile = await db.BranchProfiles.FirstOrDefaultAsync(p => p.BranchId == b.Id);
        var full = string.Join(", ", new[] { b.Address, b.City, b.State, b.Zip, b.Country }.Where(s => !string.IsNullOrWhiteSpace(s)));
        string? maps = null;
        if (b.Lat is { } lat && b.Lng is { } lng)
            maps = $"https://www.google.com/maps/search/?api=1&query={lat.ToString(CultureInfo.InvariantCulture)},{lng.ToString(CultureInfo.InvariantCulture)}";
        else if (full.Length > 0)
            maps = $"https://www.google.com/maps/search/?api=1&query={Uri.EscapeDataString($"{b.Name}, {full}")}";
        return new BranchInfoResponse
        {
            Id = b.Id, Name = b.Name, Address = b.Address, City = b.City, State = b.State, Country = b.Country, Zip = b.Zip,
            FullAddress = full.Length > 0 ? full : null, Lat = b.Lat, Lng = b.Lng, MapsUrl = maps,
            Phone = b.Phone, Email = b.Email, LogoUrl = b.LogoUrl,
            Amenities = profile?.Amenities, Accessibility = profile?.Accessibility,
            Hours = await HoursFor(b, DateTime.UtcNow),
            Statuses = await statuses.GetActiveAsync(b.Id),
        };
    }

    /// <summary>The caller's home branch (or the gym's first active branch).</summary>
    public async Task<BranchInfoResponse> GetMyBranchInfoAsync()
    {
        var id = await MyBranchIdAsync() ?? throw new KeyNotFoundException("This gym has no branches yet.");
        return await GetBranchInfoAsync(id);
    }

    public async Task<ulong?> MyBranchIdAsync()
    {
        var me = currentUser.UserId ?? 0;
        var mine = await db.Users.IgnoreQueryFilters().Where(u => u.Id == me).Select(u => u.BranchId).FirstOrDefaultAsync();
        if (mine is { } id && await db.Branches.AnyAsync(b => b.Id == id)) return id;
        return await db.Branches.Where(b => b.Status == BranchStatus.Active).OrderBy(b => b.Id).Select(b => (ulong?)b.Id).FirstOrDefaultAsync();
    }

    public async Task<List<BranchDirectoryItem>> GetDirectoryAsync()
    {
        var mine = await MyBranchIdAsync();
        var branches = await db.Branches.Where(b => b.Status == BranchStatus.Active).OrderBy(b => b.Name).ToListAsync();
        var now = DateTime.UtcNow;
        var list = new List<BranchDirectoryItem>(branches.Count);
        foreach (var b in branches)
            list.Add(new BranchDirectoryItem
            {
                Id = b.Id, Name = b.Name, City = b.City, IsMine = b.Id == mine,
                Today = Map((await CalculatorAsync(b)).StatusAt(now)),
            });
        return list;
    }

    // ── Admin: hours editor ──────────────────────────────────────────────────

    public async Task<BranchHoursConfigResponse> GetConfigAsync(ulong branchId)
    {
        var branch = await BranchAsync(branchId);
        var zone = await ZoneForAsync(branch);
        var weekly = await db.BranchOpeningIntervals.Where(i => i.BranchId == branchId).ToListAsync();
        var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, zone));
        var exceptions = await db.BranchHoursExceptions.Where(e => e.BranchId == branchId && e.Date >= today.AddDays(-1))
            .OrderBy(e => e.Date).ToListAsync();
        var profile = await db.BranchProfiles.FirstOrDefaultAsync(p => p.BranchId == branchId);
        return new BranchHoursConfigResponse
        {
            BranchId = branch.Id, BranchName = branch.Name, Timezone = zone.Id,
            Weekly = MondayFirst.Select(d => new WeekdayHoursDto
            {
                Day = (int)d, DayName = CultureInfo.InvariantCulture.DateTimeFormat.GetDayName(d),
                Intervals = weekly.Where(w => w.DayOfWeek == d).OrderBy(w => w.OpensAt)
                    .Select(w => new IntervalDto { Opens = w.OpensAt.ToString("HH:mm"), Closes = w.ClosesAt.ToString("HH:mm") }).ToList(),
            }).ToList(),
            Exceptions = exceptions.Select(MapException).ToList(),
            Amenities = profile?.Amenities, Accessibility = profile?.Accessibility,
        };
    }

    private static HoursExceptionDto MapException(BranchHoursException e) => new()
    {
        Id = e.Id, Date = e.Date, IsClosed = e.IsClosed, Note = e.Note,
        Intervals = OpeningHoursCalculator.ParseIntervals(e.Intervals)
            .Select(i => new IntervalDto { Opens = i.Opens.ToString("HH:mm"), Closes = i.Closes.ToString("HH:mm") }).ToList(),
    };

    /// <summary>Replaces the branch's whole regular week.</summary>
    public async Task<BranchHoursConfigResponse> SetWeeklyAsync(ulong branchId, SetWeeklyHoursRequest request)
    {
        var branch = await BranchAsync(branchId);
        var days = request.Days ?? [];
        if (days.GroupBy(d => d.Day).FirstOrDefault(g => g.Count() > 1) is { } twice)
            throw new ArgumentException($"{(DayOfWeek)twice.Key} is listed twice.");
        var parsed = new List<(DayOfWeek Day, LocalInterval Interval)>();
        foreach (var day in days)
        {
            if (day.Day is < 0 or > 6) throw new ArgumentException("Day must be 0 (Sunday) to 6 (Saturday).");
            var d = (DayOfWeek)day.Day;
            parsed.AddRange(ValidateIntervals(day.Intervals, d.ToString()).Select(i => (d, i)));
        }

        var existing = await db.BranchOpeningIntervals.Where(i => i.BranchId == branchId).ToListAsync();
        db.BranchOpeningIntervals.RemoveRange(existing);
        foreach (var (day, i) in parsed)
            db.BranchOpeningIntervals.Add(new BranchOpeningInterval
            {
                TenantId = branch.TenantId, BranchId = branchId, DayOfWeek = day, OpensAt = i.Opens, ClosesAt = i.Closes,
            });
        await db.SaveChangesAsync();
        return await GetConfigAsync(branchId);
    }

    /// <summary>Parses and checks a day's intervals: valid times, no overlaps, at most <see cref="MaxIntervalsPerDay"/>.</summary>
    public static List<LocalInterval> ValidateIntervals(IEnumerable<IntervalDto>? input, string dayName)
    {
        var list = new List<LocalInterval>();
        foreach (var dto in input ?? [])
        {
            if (!OpeningHoursCalculator.TryParseTime(dto.Opens, out var o) || !OpeningHoursCalculator.TryParseTime(dto.Closes, out var c))
                throw new ArgumentException($"{dayName}: times must look like 06:00 or 22:30.");
            list.Add(new LocalInterval(o, c));
        }
        if (list.Count > MaxIntervalsPerDay) throw new ArgumentException($"{dayName}: at most {MaxIntervalsPerDay} intervals per day.");
        var sorted = list.OrderBy(i => i.Opens).ToList();
        // Only the last interval of a day may run past midnight, and nothing may overlap.
        for (var k = 0; k < sorted.Count; k++)
        {
            var cur = sorted[k];
            if (cur.IsOvernight && k < sorted.Count - 1)
                throw new ArgumentException($"{dayName}: only the last interval of a day can run past midnight.");
            if (k > 0 && cur.Opens < sorted[k - 1].Closes)
                throw new ArgumentException($"{dayName}: intervals overlap ({sorted[k - 1]} and {cur}).");
        }
        return sorted;
    }

    public async Task<HoursExceptionDto> UpsertExceptionAsync(ulong branchId, UpsertHoursExceptionRequest request)
    {
        var branch = await BranchAsync(branchId);
        var intervals = request.IsClosed ? [] : ValidateIntervals(request.Intervals, request.Date.ToString("d MMM", CultureInfo.InvariantCulture));
        if (!request.IsClosed && intervals.Count == 0)
            throw new ArgumentException("Add at least one interval for special hours, or mark the day closed.");
        var note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim();
        if (note is { Length: > 200 }) throw new ArgumentException("The note can be at most 200 characters.");

        var row = await db.BranchHoursExceptions.FirstOrDefaultAsync(e => e.BranchId == branchId && e.Date == request.Date);
        if (row is null)
        {
            row = new BranchHoursException { TenantId = branch.TenantId, BranchId = branchId, Date = request.Date };
            db.BranchHoursExceptions.Add(row);
        }
        row.IsClosed = request.IsClosed;
        row.Intervals = request.IsClosed ? null : OpeningHoursCalculator.FormatIntervals(intervals);
        row.Note = note;
        await db.SaveChangesAsync();
        return MapException(row);
    }

    public async Task<bool> DeleteExceptionAsync(ulong branchId, ulong exceptionId)
    {
        var row = await db.BranchHoursExceptions.FirstOrDefaultAsync(e => e.Id == exceptionId && e.BranchId == branchId);
        if (row is null) return false;
        db.BranchHoursExceptions.Remove(row);
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<BranchHoursConfigResponse> SetProfileAsync(ulong branchId, BranchProfileRequest request)
    {
        var branch = await BranchAsync(branchId);
        if (request.Amenities is { Length: > 5000 } || request.Accessibility is { Length: > 5000 })
            throw new ArgumentException("Amenities and accessibility notes can be at most 5,000 characters each.");
        var row = await db.BranchProfiles.FirstOrDefaultAsync(p => p.BranchId == branchId);
        if (row is null)
        {
            row = new BranchProfile { TenantId = branch.TenantId, BranchId = branchId };
            db.BranchProfiles.Add(row);
        }
        row.Amenities = string.IsNullOrWhiteSpace(request.Amenities) ? null : request.Amenities.Trim();
        row.Accessibility = string.IsNullOrWhiteSpace(request.Accessibility) ? null : request.Accessibility.Trim();
        row.UpdatedByUserId = currentUser.UserId;
        await db.SaveChangesAsync();
        return await GetConfigAsync(branchId);
    }

    // ── Settings & the self check-in gate ────────────────────────────────────

    public async Task<OperationsSettings> GetSettingsAsync(ulong? tenantId = null)
    {
        var tid = tenantId ?? currentUser.ResolveTenantId();
        var row = await db.TenantSettings.IgnoreQueryFilters().FirstOrDefaultAsync(s => s.TenantId == tid && s.Key == SettingKey);
        return row?.Value is null ? new OperationsSettings() : row.Value.Deserialize<OperationsSettings>(Json) ?? new OperationsSettings();
    }

    public async Task<OperationsSettings> UpdateSettingsAsync(OperationsSettings settings)
    {
        var tid = currentUser.ResolveTenantId();
        var row = await db.TenantSettings.FirstOrDefaultAsync(s => s.TenantId == tid && s.Key == SettingKey);
        var value = JsonSerializer.SerializeToDocument(settings, Json);
        if (row is null) db.TenantSettings.Add(new TenantSetting { TenantId = tid, Key = SettingKey, Value = value });
        else row.Value = value;
        await db.SaveChangesAsync();
        return settings;
    }

    /// <summary>
    /// Null when a member may check themselves in at the branch now; otherwise the message to show.
    /// Only when the gym turned on <see cref="OperationsSettings.BlockSelfCheckInOutsideHours"/> and
    /// the branch has hours set. Desk (staff) check-in never calls this.
    /// </summary>
    public async Task<string?> SelfCheckInBlockedReasonAsync(ulong tenantId, ulong branchId, DateTime? nowUtc = null)
    {
        if (!(await GetSettingsAsync(tenantId)).BlockSelfCheckInOutsideHours) return null;
        var branch = await db.Branches.IgnoreQueryFilters().FirstOrDefaultAsync(b => b.Id == branchId && b.TenantId == tenantId);
        if (branch is null) return null;
        var calc = await CalculatorAsync(branch);
        var now = nowUtc ?? DateTime.UtcNow;
        if (calc.IsOpenAt(now)) return null;
        var status = calc.StatusAt(now);
        return $"{branch.Name} is closed right now ({status.Label}). Please check in at the front desk.";
    }
}
