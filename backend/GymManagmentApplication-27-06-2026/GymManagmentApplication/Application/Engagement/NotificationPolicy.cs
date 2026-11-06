using System.Text.Json;

namespace GymManagmentApplication.Application.Engagement;

/// <summary>What a notification is about; each one can be switched per channel by the member.</summary>
public static class NotificationCategories
{
    public const string ClassReminders = "class_reminders";
    public const string PtReminders = "pt_reminders";
    public const string Waitlist = "waitlist";
    public const string Billing = "billing";
    public const string Announcements = "announcements";
    public const string Marketing = "marketing";
    /// <summary>Trainer ↔ member messages (push on, email off by default).</summary>
    public const string Messages = "messages";
    /// <summary>Account/service messages (new workout plan, health clearance…): always on, not shown as a toggle.</summary>
    public const string General = "general";

    /// <summary>The toggleable ones, in display order.</summary>
    public static readonly string[] All = [ClassReminders, PtReminders, Waitlist, Billing, Announcements, Messages, Marketing];

    public static bool IsToggleable(string category) => All.Contains(category);

    /// <summary>Transactional categories default on; marketing defaults off; messages default to push only.</summary>
    public static bool DefaultOn(string category, string channel = NotificationChannels.Push) =>
        category != Marketing && !(category == Messages && channel == NotificationChannels.Email);

    /// <summary>The category of an in-app notification kind ("booking", "pt", "billing", …).</summary>
    public static string ForKind(string? kind) => kind switch
    {
        "booking" or "class" or "class_reminder" => ClassReminders,
        "pt" or "pt_reminder" => PtReminders,
        "waitlist" or "waitlist_offer" => Waitlist,
        "billing" or "invoice" or "payment" => Billing,
        "announcement" => Announcements,
        "marketing" or "promo" => Marketing,
        "message" => Messages,
        _ => General,
    };
}

public static class NotificationChannels
{
    public const string Push = "push";
    public const string Email = "email";
    public static readonly string[] All = [Push, Email];
}

/// <summary>
/// The decisions behind every push: may this user get this category on this channel, and when
/// (quiet hours). Pure functions — the outbox processor and the tests share them.
/// </summary>
public static class NotificationPolicy
{
    public static readonly TimeOnly DefaultQuietStart = new(22, 0);
    public static readonly TimeOnly DefaultQuietEnd = new(7, 0);

    /// <summary>Stored overrides → effective switch (missing = default).</summary>
    public static bool Allows(JsonDocument? channels, string category, string channel)
    {
        if (!NotificationCategories.IsToggleable(category)) return true; // general/service messages
        if (channels?.RootElement is { ValueKind: JsonValueKind.Object } root
            && root.TryGetProperty(category, out var cat) && cat.ValueKind == JsonValueKind.Object
            && cat.TryGetProperty(channel, out var on) && on.ValueKind is JsonValueKind.True or JsonValueKind.False)
            return on.GetBoolean();
        return NotificationCategories.DefaultOn(category, channel);
    }

    /// <summary>True when <paramref name="local"/> falls in [start, end), wrapping midnight when start &gt; end.</summary>
    public static bool InQuietHours(TimeOnly local, TimeOnly start, TimeOnly end)
    {
        if (start == end) return false;
        return start < end ? local >= start && local < end : local >= start || local < end;
    }

    /// <summary>
    /// When a non-urgent push may go out: <paramref name="utcNow"/> outside quiet hours, otherwise
    /// the UTC instant quiet hours end in <paramref name="zone"/>.
    /// </summary>
    public static DateTime SendAfter(DateTime utcNow, TimeZoneInfo zone, bool quietEnabled, TimeOnly start, TimeOnly end, bool urgent)
    {
        if (urgent || !quietEnabled) return utcNow;
        var local = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utcNow, DateTimeKind.Utc), zone);
        if (!InQuietHours(TimeOnly.FromDateTime(local), start, end)) return utcNow;
        var endDate = DateOnly.FromDateTime(local);
        if (TimeOnly.FromDateTime(local) >= end) endDate = endDate.AddDays(1); // after start, before midnight
        var localEnd = DateTime.SpecifyKind(endDate.ToDateTime(end), DateTimeKind.Unspecified);
        // A wall-clock time skipped by a DST jump: move forward an hour.
        if (zone.IsInvalidTime(localEnd)) localEnd = localEnd.AddHours(1);
        return TimeZoneInfo.ConvertTimeToUtc(localEnd, zone);
    }

    /// <summary>Class / PT reminder kinds and when each is due.</summary>
    public const string Reminder24h = "24h";
    public const string Reminder2h = "2h";

    /// <summary>
    /// Which reminder is due now for something starting at <paramref name="startsAt"/> that was
    /// booked at <paramref name="bookedAt"/> (all UTC), or null.
    /// <list type="bullet">
    /// <item>24h: from 24 h before start until 12 h before (a catch-up window if the scheduler was
    /// down), and only if booked more than 24 h ahead — a member who books for tomorrow evening
    /// this afternoon doesn't need a "tomorrow" reminder.</item>
    /// <item>2h: from 2 h before until 10 min before start, if booked more than 2 h ahead.</item>
    /// </list>
    /// The scheduler dedupes on (booking, kind), so each fires at most once.
    /// </summary>
    public static string? DueReminder(DateTime startsAt, DateTime bookedAt, DateTime utcNow)
    {
        var until = startsAt - utcNow;
        if (until <= TimeSpan.FromMinutes(10)) return null;
        if (until <= TimeSpan.FromHours(2))
            return startsAt - bookedAt > TimeSpan.FromHours(2) ? Reminder2h : null;
        if (until <= TimeSpan.FromHours(24) && until > TimeSpan.FromHours(12))
            return startsAt - bookedAt > TimeSpan.FromHours(24) ? Reminder24h : null;
        return null;
    }
}
