using System.Globalization;
using System.Text.Json;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Domain.Entities.Core;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Messaging;

/// <summary>The gym's messaging policy (TenantSettings key <c>messaging</c>).</summary>
public class MessagingSettings
{
    /// <summary>Trainer ↔ member messaging is available at all.</summary>
    public bool Enabled { get; set; } = true;
    /// <summary>Members whose date of birth says they are under 18 can message (off by default: safeguarding).</summary>
    public bool AllowMembersUnder18 { get; set; }
    /// <summary>Optional "auto-reply" shown in the thread header to members outside working hours.</summary>
    public string? OutsideHoursNotice { get; set; }
    /// <summary>Trainers' working hours, "HH:mm" in the gym's time zone (only used for the notice).</summary>
    public string WorkingHoursStart { get; set; } = "08:00";
    public string WorkingHoursEnd { get; set; } = "20:00";

    public void Validate()
    {
        OutsideHoursNotice = string.IsNullOrWhiteSpace(OutsideHoursNotice) ? null : OutsideHoursNotice.Trim();
        if (OutsideHoursNotice is { Length: > 300 }) throw new ArgumentException("The outside-hours notice can be up to 300 characters.");
        WorkingHoursStart = MessagingRules.ParseTime(WorkingHoursStart, "Working hours start").ToString("HH:mm", CultureInfo.InvariantCulture);
        WorkingHoursEnd = MessagingRules.ParseTime(WorkingHoursEnd, "Working hours end").ToString("HH:mm", CultureInfo.InvariantCulture);
    }
}

public static class MessagingSettingsStore
{
    public const string SettingKey = "messaging";
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public static async Task<MessagingSettings> LoadAsync(IAppDbContext db, ulong tenantId, CancellationToken ct = default)
    {
        var row = await db.TenantSettings.IgnoreQueryFilters().AsNoTracking()
            .FirstOrDefaultAsync(s => s.TenantId == tenantId && s.Key == SettingKey, ct);
        return row?.Value is null ? new MessagingSettings() : row.Value.Deserialize<MessagingSettings>(Json) ?? new MessagingSettings();
    }

    public static async Task<MessagingSettings> SaveAsync(IAppDbContext db, ulong tenantId, MessagingSettings settings)
    {
        settings.Validate();
        var row = await db.TenantSettings.FirstOrDefaultAsync(s => s.TenantId == tenantId && s.Key == SettingKey);
        var value = JsonSerializer.SerializeToDocument(settings, Json);
        if (row is null) db.TenantSettings.Add(new TenantSetting { TenantId = tenantId, Key = SettingKey, Value = value });
        else { row.Value = value; row.UpdatedAt = DateTime.UtcNow; }
        await db.SaveChangesAsync();
        return settings;
    }
}

/// <summary>Why a thread can't take new messages (machine-readable; the note is the human text).</summary>
public static class MessagingBlocks
{
    public const string Disabled = "disabled";
    public const string Under18 = "under_18";
    public const string OptedOut = "opted_out";
    public const string NoRelationship = "no_relationship";
}

/// <summary>Messaging rules as pure functions (unit-tested; the service and the privacy flow share them).</summary>
public static class MessagingRules
{
    /// <summary>A PT session within this many days (past or future) counts as an active relationship.</summary>
    public const int RelationshipWindowDays = 90;
    public const int MaxBodyLength = 2000;
    public const int MaxClientMessageIdLength = 64;
    /// <summary>Messages one user may send per minute.</summary>
    public const int RateLimitPerMinute = 30;
    /// <summary>At most one notification per thread per recipient in this window.</summary>
    public static readonly TimeSpan PushCollapseWindow = TimeSpan.FromMinutes(5);
    public const string ReviewNotice = "Conversations may be reviewed by the gym for safety.";
    public const string RedactedText = "[removed at the member's request]";
    public const string Kind = "message";

    /// <summary>Dedupe-key prefix of a thread's pushes to one recipient (CommunicationLog.ProviderRef).</summary>
    public static string PushKeyPrefix(ulong conversationId, ulong recipientId) => $"msg:{conversationId}:{recipientId}:";

    public static bool IsUnder18(DateOnly? dob, DateOnly today)
    {
        if (dob is not { } d) return false; // unknown DOB: the gym's own onboarding decides
        var age = today.Year - d.Year;
        if (d > today.AddYears(-age)) age--;
        return age < 18;
    }

    /// <summary>True when <paramref name="local"/> is inside [start, end) (wrapping midnight when start &gt; end).</summary>
    public static bool InWorkingHours(TimeOnly local, TimeOnly start, TimeOnly end)
    {
        if (start == end) return true;
        return start < end ? local >= start && local < end : local >= start || local < end;
    }

    public static string Preview(string? body, bool photo, string? attachmentTitle)
    {
        var text = (body ?? "").ReplaceLineEndings(" ").Trim();
        if (text.Length == 0) text = attachmentTitle is not null ? $"Shared: {attachmentTitle}" : photo ? "Photo" : "";
        return text.Length > 120 ? text[..117] + "…" : text;
    }

    public static bool ValidClientMessageId(string? id) =>
        !string.IsNullOrEmpty(id) && id.Length <= MaxClientMessageIdLength && id.All(c => char.IsAsciiLetterOrDigit(c) || c is '-' or '_' or ':' or '.');

    public static TimeOnly ParseTime(string? value, string field) =>
        TimeOnly.TryParseExact((value ?? "").Trim(), ["HH:mm", "H:mm"], CultureInfo.InvariantCulture, DateTimeStyles.None, out var t)
            ? t : throw new ArgumentException($"{field}: use 24-hour HH:mm, e.g. 08:00.");
}
