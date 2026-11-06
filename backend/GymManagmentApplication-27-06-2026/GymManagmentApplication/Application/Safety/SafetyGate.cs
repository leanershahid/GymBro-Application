using System.Text.Json;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Domain.Entities.Core;
using GymManagmentApplication.Domain.Entities.Safety;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Safety;

/// <summary>
/// 422 thrown when a member tries to book / check in without a current waiver or health check.
/// The envelope carries <c>code = "SAFETY_REQUIRED"</c> and <c>data = { missing, context }</c>;
/// the app opens the waiver / health flow when it sees that code.
/// </summary>
public sealed class SafetyGateException(string message, IReadOnlyList<string> missing, string context)
    : RuleException(message, UnprocessableStatus)
{
    public const string ErrorCode = "SAFETY_REQUIRED";
    public IReadOnlyList<string> Missing { get; } = missing;
    public string Context { get; } = context;
}

/// <summary>
/// Works out whether a member is "cleared to train" — a current signed waiver (every active waiver
/// of the gym), a non-expired health questionnaire, and optionally an emergency contact — and
/// enforces it on booking and self check-in when the gym's gating setting is on (default ON).
/// </summary>
public class SafetyGate(IAppDbContext db, ICurrentUser currentUser)
{
    public const string SettingKey = "safety";
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    // ── Settings ────────────────────────────────────────────────────────────

    public async Task<SafetySettings> LoadSettingsAsync(ulong tenantId)
    {
        var row = await db.TenantSettings.IgnoreQueryFilters().AsNoTracking()
            .FirstOrDefaultAsync(s => s.TenantId == tenantId && s.Key == SettingKey);
        return row?.Value is null ? new SafetySettings() : row.Value.Deserialize<SafetySettings>(Json) ?? new SafetySettings();
    }

    public async Task<SafetySettings> SaveSettingsAsync(ulong tenantId, SafetySettings settings)
    {
        if (settings.HealthValidDays is < 30 or > 1095)
            throw new ArgumentException("Health check validity must be between 30 and 1,095 days.");
        var row = await db.TenantSettings.FirstOrDefaultAsync(s => s.TenantId == tenantId && s.Key == SettingKey);
        var value = JsonSerializer.SerializeToDocument(settings, Json);
        if (row is null) db.TenantSettings.Add(new TenantSetting { TenantId = tenantId, Key = SettingKey, Value = value });
        else row.Value = value;
        await db.SaveChangesAsync();
        return settings;
    }

    // ── Evaluation ──────────────────────────────────────────────────────────

    /// <summary>The member's tenant (tenant-filtered for everyone but super admins).</summary>
    public async Task<ulong> TenantOfAsync(ulong userId) =>
        await db.Users.Where(u => u.Id == userId).Select(u => (ulong?)u.TenantId).FirstOrDefaultAsync()
        ?? throw new KeyNotFoundException("Member not found.");

    public async Task<SafetyComplianceResponse> EvaluateAsync(ulong userId)
    {
        var tenantId = await TenantOfAsync(userId);
        var settings = await LoadSettingsAsync(tenantId);
        var now = DateTime.UtcNow;

        var waivers = await WaiverStatusesAsync(tenantId, userId);
        var waiverOk = waivers.All(w => w.Ok);

        var latest = await db.HealthScreenings.AsNoTracking()
            .Where(h => h.TenantId == tenantId && h.UserId == userId)
            .OrderByDescending(h => h.SubmittedAt)
            .FirstOrDefaultAsync();
        var health = HealthStatus(latest, now);

        var emergency = await EmergencyContacts.GetAsync(db, tenantId, userId);
        var hasConsent = await Consents.IsGrantedAsync(db, tenantId, userId, ConsentTypes.HealthData);

        var missing = new List<string>();
        if (!waiverOk) missing.Add("waiver");
        if (health.Status == "missing") missing.Add("health");
        else if (health.Status == "expired") missing.Add("health_expired");
        else if (settings.BlockUntilCleared && health.Status == "needs_clearance") missing.Add("clearance");
        if (settings.RequireEmergencyContact && emergency is null) missing.Add("emergency_contact");

        // Checklist: the waiver step only counts when the gym has a waiver to sign.
        var stepsTotal = (waivers.Count > 0 ? 1 : 0) + 2;
        var healthDone = health.Status is "current" or "needs_clearance" or "cleared";
        var stepsDone = (waivers.Count > 0 && waiverOk ? 1 : 0) + (healthDone ? 1 : 0) + (emergency is not null ? 1 : 0);
        health.Ok = healthDone && !(settings.BlockUntilCleared && health.Status == "needs_clearance");

        return new SafetyComplianceResponse
        {
            UserId = userId,
            GatingEnabled = settings.GatingEnabled,
            Waivers = waivers,
            WaiverOk = waiverOk,
            Health = health,
            HasHealthDataConsent = hasConsent,
            EmergencyContact = emergency,
            EmergencyOk = emergency is not null,
            Missing = missing,
            CanBook = !settings.GatingEnabled || missing.Count == 0,
            StepsDone = stepsDone,
            StepsTotal = stepsTotal,
            ChecklistComplete = stepsDone == stepsTotal,
        };
    }

    internal static HealthStatusResponse HealthStatus(HealthScreening? latest, DateTime now)
    {
        if (latest is null) return new HealthStatusResponse { Status = "missing" };
        var status = latest.ExpiresAt <= now ? "expired"
            : latest.NeedsClearance && latest.ClearedAt is null ? "needs_clearance"
            : latest.NeedsClearance ? "cleared"
            : "current";
        return new HealthStatusResponse
        {
            Status = status, ScreeningId = latest.Id, SubmittedAt = latest.SubmittedAt, ExpiresAt = latest.ExpiresAt,
            NeedsClearance = latest.NeedsClearance && latest.ClearedAt is null, ClearedAt = latest.ClearedAt,
        };
    }

    /// <summary>
    /// One row per active waiver. A signature of the latest version is "signed"; a signature of an
    /// older version still counts unless a version published after it requires re-signing.
    /// </summary>
    public async Task<List<WaiverStatusResponse>> WaiverStatusesAsync(ulong tenantId, ulong userId)
    {
        var versions = await db.WaiverVersions.AsNoTracking()
            .Where(v => v.TenantId == tenantId && v.Waiver.IsActive)
            .Select(v => new { v.Id, v.WaiverId, v.Version, v.RequiresResign, DocTitle = v.Waiver.Title })
            .ToListAsync();
        if (versions.Count == 0) return [];

        var signatures = await db.WaiverSignatures.AsNoTracking()
            .Where(s => s.TenantId == tenantId && s.UserId == userId)
            .Select(s => new { s.Id, s.WaiverId, s.VersionNumber, s.SignedAt })
            .ToListAsync();

        return versions.GroupBy(v => v.WaiverId).Select(g =>
        {
            var latest = g.MaxBy(v => v.Version)!;
            var best = signatures.Where(s => s.WaiverId == g.Key).MaxBy(s => s.VersionNumber);
            var row = new WaiverStatusResponse
            {
                WaiverId = g.Key, Title = latest.DocTitle, LatestVersionId = latest.Id, LatestVersion = latest.Version,
                SignedVersion = best?.VersionNumber, SignedAt = best?.SignedAt, SignatureId = best?.Id,
            };
            if (best is null) row.Status = "unsigned";
            else if (best.VersionNumber >= latest.Version) row.Status = "signed";
            else row.Status = g.Any(v => v.Version > best.VersionNumber && v.RequiresResign) ? "resign_required" : "signed";
            row.Ok = row.Status == "signed";
            return row;
        }).OrderBy(w => w.Title).ToList();
    }

    // ── Enforcement ─────────────────────────────────────────────────────────

    /// <summary>
    /// Throws <see cref="SafetyGateException"/> (422, SAFETY_REQUIRED) when gating is on and the
    /// member isn't cleared. <paramref name="context"/>: class_booking · pt_booking · self_checkin.
    /// </summary>
    public async Task EnsureClearedAsync(ulong userId, string context)
    {
        var c = await EvaluateAsync(userId);
        if (c.CanBook) return;
        throw new SafetyGateException(Describe(c.Missing, context), c.Missing, context)
        {
            Code = SafetyGateException.ErrorCode,
            Payload = new { missing = c.Missing, context },
        };
    }

    /// <summary>For the front desk: what is missing (empty = fine, or gating off). Never throws.</summary>
    public async Task<List<string>> MissingForDeskAsync(ulong userId)
    {
        var c = await EvaluateAsync(userId);
        return c.GatingEnabled ? c.Missing : [];
    }

    /// <summary>Records that staff let a member through despite <paramref name="missing"/>.</summary>
    public void RecordOverride(ulong tenantId, ulong userId, IReadOnlyCollection<string> missing, string context, string? reason, ulong? attendanceId)
    {
        db.SafetyGateOverrides.Add(new SafetyGateOverride
        {
            TenantId = tenantId, UserId = userId, OverriddenByUserId = currentUser.UserId ?? 0,
            Context = context, Missing = string.Join(',', missing), Reason = reason?.Trim() is { Length: > 0 } r ? r[..Math.Min(r.Length, 500)] : null,
            AttendanceId = attendanceId, At = DateTime.UtcNow,
        });
    }

    public static string Describe(IReadOnlyCollection<string> missing, string context)
    {
        var parts = new List<string>();
        if (missing.Contains("waiver")) parts.Add("sign the gym's waiver");
        if (missing.Contains("health")) parts.Add("complete the health check");
        if (missing.Contains("health_expired")) parts.Add("renew your health check (it has expired)");
        if (missing.Contains("clearance")) parts.Add("get medical clearance confirmed by the gym");
        if (missing.Contains("emergency_contact")) parts.Add("add an emergency contact");
        var action = context switch
        {
            "class_booking" => "booking a class",
            "pt_booking" => "booking a PT session",
            "self_checkin" => "checking in",
            _ => "continuing",
        };
        return parts.Count == 0 ? "Please complete your safety checks first."
            : $"Before {action}, please {string.Join(" and ", parts)}.";
    }
}
