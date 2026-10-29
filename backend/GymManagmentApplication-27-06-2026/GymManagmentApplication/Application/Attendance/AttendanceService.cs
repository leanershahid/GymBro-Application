using System.Text.Json;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Domain.Entities.Core;
using GymManagmentApplication.Domain.Enums;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using AttendanceEntity = GymManagmentApplication.Domain.Entities.Scheduling.Attendance;

namespace GymManagmentApplication.Application.Attendance;

public interface IAttendanceService
{
    Task<AttendanceSettingsResponse> GetSettingsAsync();
    Task<AttendanceSettingsResponse> UpdateSettingsAsync(AttendanceSettings settings);
    Task<BranchGeofenceResponse?> SetBranchGeofenceAsync(ulong branchId, SetBranchGeofenceRequest request);
    Task<bool> ClearBranchGeofenceAsync(ulong branchId);
    Task<MyAttendanceStatusResponse> GetMyStatusAsync();
    Task<CheckInResultResponse> CheckInByLocationAsync(LocationCheckRequest request);
    Task<AttendanceRecordResponse?> CheckOutAsync(LocationCheckRequest? request);
    Task<List<AttendanceRecordResponse>> GetMyHistoryAsync(int days);
    Task<PagedResponse<AttendanceRecordResponse>> GetAllAsync(DateOnly? date, ulong? branchId, int page, int size, ulong? userId = null);
    /// <summary>Records a biometric (face/fingerprint) entry as attendance when that method is enabled.</summary>
    Task RecordBiometricAsync(ulong userId, ulong branchId, AttendanceMethod method, string? device);
}

public class AttendanceService(AppDbContext db, ICurrentUser currentUser) : IAttendanceService
{
    private const string SettingKey = "attendance";
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    // ── Settings ─────────────────────────────────────────────────────────────

    private async Task<AttendanceSettings> LoadSettingsAsync(ulong tenantId)
    {
        var row = await db.TenantSettings.FirstOrDefaultAsync(s => s.TenantId == tenantId && s.Key == SettingKey);
        return row?.Value is null ? new AttendanceSettings()
            : row.Value.Deserialize<AttendanceSettings>(Json) ?? new AttendanceSettings();
    }

    public async Task<AttendanceSettingsResponse> GetSettingsAsync()
    {
        var tenantId = currentUser.ResolveTenantId();
        var settings = await LoadSettingsAsync(tenantId);
        return new AttendanceSettingsResponse { Settings = settings, Branches = await BranchesAsync(settings, onlyActive: false) };
    }

    public async Task<AttendanceSettingsResponse> UpdateSettingsAsync(AttendanceSettings settings)
    {
        if (settings.DefaultRadiusM is < 20 or > 5000)
            throw new ArgumentException("Default radius must be between 20 m and 5,000 m.");
        if (settings.MaxAccuracyM is < 10 or > 1000)
            throw new ArgumentException("Maximum GPS accuracy must be between 10 m and 1,000 m.");

        var tenantId = currentUser.ResolveTenantId();
        var row = await db.TenantSettings.FirstOrDefaultAsync(s => s.TenantId == tenantId && s.Key == SettingKey);
        var value = JsonSerializer.SerializeToDocument(settings, Json);
        if (row is null)
            db.TenantSettings.Add(new TenantSetting { TenantId = tenantId, Key = SettingKey, Value = value });
        else
        {
            row.Value = value;
            row.UpdatedAt = DateTime.UtcNow;
        }
        await db.SaveChangesAsync();
        return await GetSettingsAsync();
    }

    public async Task<BranchGeofenceResponse?> SetBranchGeofenceAsync(ulong branchId, SetBranchGeofenceRequest request)
    {
        if (request.Lat.HasValue != request.Lng.HasValue)
            throw new ArgumentException("Provide both latitude and longitude.");
        if (request.Lat is < -90 or > 90 || request.Lng is < -180 or > 180)
            throw new ArgumentException("Latitude must be between -90 and 90, longitude between -180 and 180.");
        if (request.RadiusM is { } r && (r < 20 || r > 5000))
            throw new ArgumentException("Radius must be between 20 m and 5,000 m.");

        var branch = await db.Branches.FirstOrDefaultAsync(b => b.Id == branchId); // tenant-filtered
        if (branch is null) return null;
        if (request.Lat is { } lat && request.Lng is { } lng)
        {
            branch.Lat = Math.Round(lat, 7);
            branch.Lng = Math.Round(lng, 7);
        }
        if (request.Enabled && (branch.Lat is null || branch.Lng is null))
            throw new ArgumentException("Set the branch location before turning on location check-in.");
        branch.LocationCheckInEnabled = request.Enabled;
        branch.GeofenceRadiusM = request.RadiusM;
        branch.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        var settings = await LoadSettingsAsync(branch.TenantId);
        return ToGeofence(branch, settings);
    }

    public async Task<bool> ClearBranchGeofenceAsync(ulong branchId)
    {
        var branch = await db.Branches.FirstOrDefaultAsync(b => b.Id == branchId);
        if (branch is null) return false;
        branch.Lat = null;
        branch.Lng = null;
        branch.GeofenceRadiusM = null;
        branch.LocationCheckInEnabled = false;
        branch.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return true;
    }

    private async Task<List<BranchGeofenceResponse>> BranchesAsync(AttendanceSettings settings, bool onlyActive)
    {
        var branches = await db.Branches.Where(b => b.Status == BranchStatus.Active).OrderBy(b => b.Name).ToListAsync();
        return branches.Select(b => ToGeofence(b, settings))
            .Where(g => !onlyActive || g.IsActive)
            .ToList();
    }

    private static BranchGeofenceResponse ToGeofence(Domain.Entities.Core.Branch b, AttendanceSettings s) => new()
    {
        BranchId = b.Id, Name = b.Name, City = b.City, Lat = b.Lat, Lng = b.Lng,
        RadiusM = b.Lat.HasValue && b.Lng.HasValue ? b.GeofenceRadiusM ?? s.DefaultRadiusM : null,
        HasOwnRadius = b.GeofenceRadiusM.HasValue,
        Enabled = b.LocationCheckInEnabled,
    };

    // ── Member / trainer check-in ────────────────────────────────────────────

    private ulong Me => currentUser.UserId ?? throw new UnauthorizedAccessException("Sign in again.");

    private Task<AttendanceEntity?> OpenVisitAsync(ulong userId) =>
        db.Attendances.Include(a => a.Branch)
            .Where(a => a.UserId == userId && a.CheckOutAt == null)
            .OrderByDescending(a => a.CheckInAt)
            .FirstOrDefaultAsync();

    public async Task<MyAttendanceStatusResponse> GetMyStatusAsync()
    {
        var settings = await LoadSettingsAsync(currentUser.ResolveTenantId());
        var monthStart = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var open = await OpenVisitAsync(Me);
        var branches = await BranchesAsync(settings, onlyActive: true);
        return new MyAttendanceStatusResponse
        {
            LocationEnabled = branches.Count > 0,
            OpenVisit = open is null ? null : Map(open),
            Branches = branches,
            VisitsThisMonth = await db.Attendances.CountAsync(a => a.UserId == Me && a.CheckInAt >= monthStart),
        };
    }

    public async Task<CheckInResultResponse> CheckInByLocationAsync(LocationCheckRequest request)
    {
        var tenantId = currentUser.ResolveTenantId();
        var settings = await LoadSettingsAsync(tenantId);
        ValidateFix(request, settings);

        // Already inside a visit? Return it instead of creating a duplicate.
        var open = await OpenVisitAsync(Me);
        if (open is not null)
            return new CheckInResultResponse { CheckedIn = true, Message = $"You're already checked in at {open.Branch.Name}.", Visit = Map(open) };

        if (await MembershipBlockReasonAsync(Me) is { } blocked)
            return new CheckInResultResponse { CheckedIn = false, Message = blocked };

        var candidates = (await BranchesAsync(settings, onlyActive: true))
            .Where(b => request.BranchId is null || b.BranchId == request.BranchId)
            .Select(b => (Branch: b, Distance: DistanceM(request.Lat, request.Lng, (double)b.Lat!.Value, (double)b.Lng!.Value)))
            .OrderBy(x => x.Distance)
            .ToList();
        if (candidates.Count == 0)
            throw new ArgumentException(request.BranchId is null
                ? "Location check-in isn't turned on at any branch of this gym yet."
                : "Location check-in isn't turned on at that branch.");

        var nearest = candidates[0];
        var distance = (int)Math.Round(nearest.Distance);
        if (distance > nearest.Branch.RadiusM)
            return new CheckInResultResponse
            {
                CheckedIn = false, DistanceM = distance, NearestBranch = nearest.Branch.Name,
                Message = $"You're {FormatDistance(distance)} from {nearest.Branch.Name}. Check in when you're within {nearest.Branch.RadiusM} m.",
            };

        var visit = new AttendanceEntity
        {
            TenantId = tenantId,
            BranchId = nearest.Branch.BranchId,
            UserId = Me,
            CheckInAt = DateTime.UtcNow,
            Method = AttendanceMethod.Location,
            CheckInLat = Math.Round((decimal)request.Lat, 7),
            CheckInLng = Math.Round((decimal)request.Lng, 7),
            CheckInDistanceM = distance,
        };
        db.Attendances.Add(visit);
        await db.SaveChangesAsync();
        await db.Entry(visit).Reference(v => v.Branch).LoadAsync();
        return new CheckInResultResponse
        {
            CheckedIn = true, DistanceM = distance, NearestBranch = nearest.Branch.Name,
            Message = $"Checked in at {nearest.Branch.Name}.", Visit = Map(visit),
        };
    }

    public async Task<AttendanceRecordResponse?> CheckOutAsync(LocationCheckRequest? request)
    {
        var open = await OpenVisitAsync(Me);
        if (open is null) return null;
        open.CheckOutAt = DateTime.UtcNow;
        open.DurationMin = (short)Math.Clamp((open.CheckOutAt.Value - open.CheckInAt).TotalMinutes, 0, short.MaxValue);
        await db.SaveChangesAsync();
        return Map(open);
    }

    public async Task<List<AttendanceRecordResponse>> GetMyHistoryAsync(int days)
    {
        var since = DateTime.UtcNow.AddDays(-Math.Clamp(days, 1, 365));
        var rows = await db.Attendances.Include(a => a.Branch)
            .Where(a => a.UserId == Me && a.CheckInAt >= since)
            .OrderByDescending(a => a.CheckInAt).Take(200).ToListAsync();
        return rows.Select(Map).ToList();
    }

    public async Task<PagedResponse<AttendanceRecordResponse>> GetAllAsync(DateOnly? date, ulong? branchId, int page, int size, ulong? userId = null)
    {
        page = Math.Max(1, page);
        size = Math.Clamp(size, 1, 100);
        var q = db.Attendances.Include(a => a.Branch).Include(a => a.User).AsQueryable(); // tenant-filtered
        if (date is { } d)
        {
            // The date is a day in the gym's time zone.
            var from = (await TenantClock.ForAsync(db, currentUser.TenantId)).StartOfDayUtc(d);
            q = q.Where(a => a.CheckInAt >= from && a.CheckInAt < from.AddDays(1));
        }
        if (branchId is { } b) q = q.Where(a => a.BranchId == b);
        if (userId is { } u) q = q.Where(a => a.UserId == u);

        var total = await q.CountAsync();
        var rows = await q.OrderByDescending(a => a.CheckInAt).Page(page, size).ToListAsync();
        return new PagedResponse<AttendanceRecordResponse>
        {
            Items = rows.Select(Map), PageNumber = page, PageSize = size, TotalRecords = total,
        };
    }

    public async Task RecordBiometricAsync(ulong userId, ulong branchId, AttendanceMethod method, string? device)
    {
        var user = await db.Users.IgnoreQueryFilters().FirstOrDefaultAsync(u => u.Id == userId);
        if (user is null) return;
        var settings = await LoadSettingsAsync(user.TenantId);
        var enabled = method == AttendanceMethod.Face ? settings.FaceEnabled : settings.FingerprintEnabled;
        if (!enabled) return;

        // One open visit at a time: a second scan while inside is ignored.
        if (await db.Attendances.IgnoreQueryFilters().AnyAsync(a => a.UserId == userId && a.CheckOutAt == null))
            return;
        if (await MembershipBlockReasonAsync(userId) is not null) return;

        db.Attendances.Add(new AttendanceEntity
        {
            TenantId = user.TenantId, BranchId = branchId, UserId = userId,
            CheckInAt = DateTime.UtcNow, Method = method, GateDevice = device,
        });
        await db.SaveChangesAsync();
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    /// <summary>
    /// Why a member may not check in, or null if they may. Members whose memberships have all
    /// expired, been cancelled or are frozen are refused. Members with no membership record at
    /// all are still let in (gyms that don't track memberships in the app yet), as are staff.
    /// </summary>
    private async Task<string?> MembershipBlockReasonAsync(ulong userId)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var memberships = await db.GymMemberships.IgnoreQueryFilters()
            .Where(m => m.UserId == userId)
            .Select(m => new { m.Status, m.StartsAt, m.EndsAt })
            .ToListAsync();
        if (memberships.Count == 0) return null;

        if (memberships.Any(m => (m.Status == MembershipStatus.Active || m.Status == MembershipStatus.Trial)
                                 && m.StartsAt <= today && (m.EndsAt is null || m.EndsAt >= today)))
            return null;
        if (memberships.Any(m => m.Status == MembershipStatus.Paused))
            return "Your membership is frozen. Ask the front desk to unfreeze it.";
        if (memberships.Any(m => (m.Status == MembershipStatus.Active || m.Status == MembershipStatus.Trial) && m.StartsAt > today))
            return "Your membership hasn't started yet.";
        return "Your membership has expired. Please renew it to check in.";
    }

    private static void ValidateFix(LocationCheckRequest r, AttendanceSettings s)
    {
        if (r.Lat is < -90 or > 90 || r.Lng is < -180 or > 180)
            throw new ArgumentException("Invalid location.");
        if (r.AccuracyM is { } acc && acc > s.MaxAccuracyM)
            throw new ArgumentException($"Your location is too imprecise (±{Math.Round(acc)} m). Move to an open area or turn on precise location and try again.");
    }

    /// <summary>Great-circle distance in metres (haversine).</summary>
    private static double DistanceM(double lat1, double lng1, double lat2, double lng2)
    {
        const double R = 6_371_000;
        double rad(double d) => d * Math.PI / 180;
        var dLat = rad(lat2 - lat1);
        var dLng = rad(lng2 - lng1);
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos(rad(lat1)) * Math.Cos(rad(lat2)) * Math.Sin(dLng / 2) * Math.Sin(dLng / 2);
        return 2 * R * Math.Asin(Math.Min(1, Math.Sqrt(a)));
    }

    private static string FormatDistance(int m) => m >= 1000 ? $"{m / 1000.0:0.0} km" : $"{m} m";

    private static AttendanceRecordResponse Map(AttendanceEntity a) => new()
    {
        Id = a.Id, UserId = a.UserId,
        UserName = a.User is null ? null : $"{a.User.FirstName} {a.User.LastName}".Trim(),
        BranchId = a.BranchId, BranchName = a.Branch?.Name,
        Method = a.Method.ToString(), CheckInAt = a.CheckInAt, CheckOutAt = a.CheckOutAt,
        DurationMin = a.DurationMin, DistanceM = a.CheckInDistanceM,
    };
}
