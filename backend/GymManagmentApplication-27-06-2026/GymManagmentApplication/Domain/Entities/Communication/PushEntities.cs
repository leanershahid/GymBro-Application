namespace GymManagmentApplication.Domain.Entities.Communication;

/// <summary>
/// A phone that can receive push notifications for a user: one Expo push token
/// ("ExponentPushToken[…]"), unique across the platform. A token re-registered by another
/// account (shared device, new sign-in) moves to that account. Tokens Expo reports as
/// DeviceNotRegistered get <see cref="DisabledAt"/> and are never sent to again until re-registered.
/// </summary>
public class PushDevice
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public ulong UserId { get; set; }
    public string Token { get; set; } = default!;
    /// <summary>One of <see cref="PushPlatforms"/>.</summary>
    public string Platform { get; set; } = PushPlatforms.Android;
    public string? DeviceName { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime LastSeenAt { get; set; } = DateTime.UtcNow;
    public DateTime? DisabledAt { get; set; }
    /// <summary>Why it was disabled: "DeviceNotRegistered", "signed_out", …</summary>
    public string? DisabledReason { get; set; }

    public Identity.User User { get; set; } = default!;
}

public static class PushPlatforms
{
    public const string Ios = "ios";
    public const string Android = "android";
    public const string Web = "web";
    public static readonly string[] All = [Ios, Android, Web];
}

/// <summary>
/// A user's notification choices: per category × channel switches (only the ones they changed
/// from the defaults are stored, as JSON) and quiet hours. No row = all defaults
/// (transactional on, marketing off, quiet hours 22:00–07:00 in their branch/gym time zone).
/// </summary>
public class NotificationPreference
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public ulong UserId { get; set; }
    /// <summary>{"class_reminders":{"push":true,"email":false}, …} — see NotificationCategories.</summary>
    public System.Text.Json.JsonDocument? Channels { get; set; }
    public bool QuietHoursEnabled { get; set; } = true;
    /// <summary>Local wall-clock start/end ("22:00" → "07:00"); may wrap midnight.</summary>
    public TimeOnly QuietStart { get; set; } = new(22, 0);
    public TimeOnly QuietEnd { get; set; } = new(7, 0);
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public Identity.User User { get; set; } = default!;
}
