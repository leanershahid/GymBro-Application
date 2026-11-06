using System.Globalization;
using System.Text.Json;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Safety;
using GymManagmentApplication.Domain.Entities.Communication;
using GymManagmentApplication.Domain.Entities.Safety;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Engagement;

// ── DTOs ─────────────────────────────────────────────────────────────────────

public class NotificationCategoryPreference
{
    public string Category { get; set; } = "";
    public bool Push { get; set; }
    public bool Email { get; set; }
}

public class NotificationPreferencesResponse
{
    /// <summary>One entry per toggleable category, in display order.</summary>
    public List<NotificationCategoryPreference> Categories { get; set; } = [];
    public bool QuietHoursEnabled { get; set; }
    /// <summary>"HH:mm", local to the member's branch / gym.</summary>
    public string QuietStart { get; set; } = "22:00";
    public string QuietEnd { get; set; } = "07:00";
    /// <summary>IANA id the quiet hours are judged in.</summary>
    public string TimeZone { get; set; } = "UTC";
    /// <summary>The caller has at least one phone registered for push.</summary>
    public bool HasPushDevice { get; set; }
}

public class UpdateNotificationPreferencesRequest
{
    /// <summary>Only the categories sent are changed; unknown categories are rejected.</summary>
    public List<NotificationCategoryPreference>? Categories { get; set; }
    public bool? QuietHoursEnabled { get; set; }
    public string? QuietStart { get; set; }
    public string? QuietEnd { get; set; }
}

public class RegisterPushDeviceRequest
{
    public string Token { get; set; } = "";
    /// <summary>ios | android | web.</summary>
    public string Platform { get; set; } = "";
    public string? DeviceName { get; set; }
}

public class UnregisterPushDeviceRequest
{
    public string Token { get; set; } = "";
}

// ── Preferences ──────────────────────────────────────────────────────────────

/// <summary>GET/PUT /api/me/notification-preferences. Marketing switches also append a consent record.</summary>
public class NotificationPreferenceService(IAppDbContext db, ICurrentUser currentUser, ConsentService? consents = null)
{
    private ulong Me => currentUser.UserId ?? throw new UnauthorizedAccessException("Sign in again.");

    public async Task<NotificationPreferencesResponse> GetMineAsync()
    {
        var me = Me;
        var pref = await db.NotificationPreferences.AsNoTracking().FirstOrDefaultAsync(p => p.UserId == me);
        var zone = await db.Users.AsNoTracking().Where(u => u.Id == me)
            .Select(u => u.Branch != null && u.Branch.Timezone != "UTC" && u.Branch.Timezone != "" ? u.Branch.Timezone : u.Tenant.Timezone)
            .FirstOrDefaultAsync();
        return new NotificationPreferencesResponse
        {
            Categories = NotificationCategories.All.Select(c => new NotificationCategoryPreference
            {
                Category = c,
                Push = NotificationPolicy.Allows(pref?.Channels, c, NotificationChannels.Push),
                Email = NotificationPolicy.Allows(pref?.Channels, c, NotificationChannels.Email),
            }).ToList(),
            QuietHoursEnabled = pref?.QuietHoursEnabled ?? true,
            QuietStart = (pref?.QuietStart ?? NotificationPolicy.DefaultQuietStart).ToString("HH:mm", CultureInfo.InvariantCulture),
            QuietEnd = (pref?.QuietEnd ?? NotificationPolicy.DefaultQuietEnd).ToString("HH:mm", CultureInfo.InvariantCulture),
            TimeZone = TenantClock.Resolve(zone).Id,
            HasPushDevice = await db.PushDevices.AnyAsync(d => d.UserId == me && d.DisabledAt == null),
        };
    }

    public async Task<NotificationPreferencesResponse> UpdateMineAsync(UpdateNotificationPreferencesRequest r, string? ip = null)
    {
        var me = Me;
        var tenantId = await db.Users.Where(u => u.Id == me).Select(u => (ulong?)u.TenantId).FirstOrDefaultAsync()
                       ?? throw new KeyNotFoundException("Account not found.");
        var pref = await db.NotificationPreferences.FirstOrDefaultAsync(p => p.UserId == me);
        if (pref is null)
        {
            pref = new NotificationPreference { TenantId = tenantId, UserId = me };
            db.NotificationPreferences.Add(pref);
        }

        var map = ReadChannels(pref.Channels);
        var marketingChanges = new List<(string Type, bool Granted)>();
        foreach (var c in r.Categories ?? [])
        {
            var cat = (c.Category ?? "").Trim().ToLowerInvariant();
            if (!NotificationCategories.IsToggleable(cat))
                throw new ArgumentException($"Category: must be one of {string.Join(", ", NotificationCategories.All)}.");
            var before = (Push: NotificationPolicy.Allows(pref.Channels, cat, NotificationChannels.Push),
                          Email: NotificationPolicy.Allows(pref.Channels, cat, NotificationChannels.Email));
            map[cat] = new Dictionary<string, bool> { [NotificationChannels.Push] = c.Push, [NotificationChannels.Email] = c.Email };
            if (cat == NotificationCategories.Marketing)
            {
                if (before.Push != c.Push) marketingChanges.Add((ConsentTypes.MarketingPush, c.Push));
                if (before.Email != c.Email) marketingChanges.Add((ConsentTypes.MarketingEmail, c.Email));
            }
        }
        pref.Channels = JsonSerializer.SerializeToDocument(map);

        if (r.QuietHoursEnabled is { } q) pref.QuietHoursEnabled = q;
        if (r.QuietStart is not null) pref.QuietStart = ParseTime(r.QuietStart, "QuietStart");
        if (r.QuietEnd is not null) pref.QuietEnd = ParseTime(r.QuietEnd, "QuietEnd");
        pref.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        // Marketing switches double as consent (append-only record, Safety module). Recorded after the
        // preference is saved; RecordMineAsync is a no-op when the consent already matches.
        if (consents is not null)
            foreach (var (type, granted) in marketingChanges)
                await consents.RecordMineAsync(new RecordConsentRequest { Type = type, Granted = granted, Source = "app" }, ip);

        return await GetMineAsync();
    }

    /// <summary>For senders of email (and anything else outside the push outbox): may this user get it?</summary>
    public static async Task<bool> AllowsAsync(IAppDbContext db, ulong userId, string category, string channel, CancellationToken ct = default)
    {
        var channels = await db.NotificationPreferences.IgnoreQueryFilters().AsNoTracking()
            .Where(p => p.UserId == userId).Select(p => p.Channels).FirstOrDefaultAsync(ct);
        return NotificationPolicy.Allows(channels, category, channel);
    }

    private static Dictionary<string, Dictionary<string, bool>> ReadChannels(JsonDocument? doc)
    {
        var map = new Dictionary<string, Dictionary<string, bool>>();
        if (doc?.RootElement is not { ValueKind: JsonValueKind.Object } root) return map;
        foreach (var cat in root.EnumerateObject())
        {
            if (cat.Value.ValueKind != JsonValueKind.Object) continue;
            var ch = new Dictionary<string, bool>();
            foreach (var c in cat.Value.EnumerateObject())
                if (c.Value.ValueKind is JsonValueKind.True or JsonValueKind.False) ch[c.Name] = c.Value.GetBoolean();
            map[cat.Name] = ch;
        }
        return map;
    }

    private static TimeOnly ParseTime(string value, string field) =>
        TimeOnly.TryParseExact(value.Trim(), ["HH:mm", "H:mm", "HH:mm:ss"], CultureInfo.InvariantCulture, DateTimeStyles.None, out var t)
            ? t : throw new ArgumentException($"{field}: use 24-hour HH:mm, e.g. 22:00.");
}

// ── Devices ──────────────────────────────────────────────────────────────────

/// <summary>POST/DELETE /api/me/push-devices: the app registers its Expo push token after sign-in.</summary>
public class PushDeviceService(IAppDbContext db, ICurrentUser currentUser)
{
    public async Task RegisterAsync(RegisterPushDeviceRequest r)
    {
        var me = currentUser.UserId ?? throw new UnauthorizedAccessException("Sign in again.");
        var token = (r.Token ?? "").Trim();
        if (!IsExpoToken(token)) throw new ArgumentException("Token: expected an Expo push token (ExponentPushToken[…]).");
        var platform = (r.Platform ?? "").Trim().ToLowerInvariant();
        if (!PushPlatforms.All.Contains(platform)) throw new ArgumentException($"Platform: must be one of {string.Join(", ", PushPlatforms.All)}.");
        var tenantId = await db.Users.Where(u => u.Id == me).Select(u => (ulong?)u.TenantId).FirstOrDefaultAsync()
                       ?? throw new KeyNotFoundException("Account not found.");

        // Tokens are unique platform-wide: a device that signs into another account (any gym) moves.
        var device = await db.PushDevices.IgnoreQueryFilters().FirstOrDefaultAsync(d => d.Token == token);
        var now = DateTime.UtcNow;
        if (device is null)
        {
            device = new PushDevice { Token = token, CreatedAt = now };
            db.PushDevices.Add(device);
        }
        device.TenantId = tenantId;
        device.UserId = me;
        device.Platform = platform;
        device.DisabledAt = null;
        device.DisabledReason = null;
        device.LastSeenAt = now;
        var name = r.DeviceName?.Trim();
        if (!string.IsNullOrEmpty(name)) device.DeviceName = name.Length > 120 ? name[..120] : name;
        await db.SaveChangesAsync();
    }

    /// <summary>Sign-out: this device stops receiving the caller's pushes. Unknown tokens are ignored.</summary>
    public async Task UnregisterAsync(string token)
    {
        var me = currentUser.UserId ?? throw new UnauthorizedAccessException("Sign in again.");
        token = (token ?? "").Trim();
        var device = await db.PushDevices.IgnoreQueryFilters().FirstOrDefaultAsync(d => d.Token == token && d.UserId == me);
        if (device is null || device.DisabledAt is not null) return;
        device.DisabledAt = DateTime.UtcNow;
        device.DisabledReason = "signed_out";
        await db.SaveChangesAsync();
    }

    public static bool IsExpoToken(string token) =>
        token.Length is > 20 and <= 255
        && (token.StartsWith("ExponentPushToken[", StringComparison.Ordinal) || token.StartsWith("ExpoPushToken[", StringComparison.Ordinal))
        && token.EndsWith(']');
}
