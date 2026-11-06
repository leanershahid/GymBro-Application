using System.Text.Json;

namespace GymManagmentApplication.Domain.Entities.Privacy;

// Privacy controls (roadmap feature 2): account deletion with a grace period, and data exports.
// Mapping: Infrastructure/Data/Configurations/PrivacyConfigurations.cs. Consents are feature 1's ConsentRecords.

/// <summary>
/// A request to delete (anonymise) a member's account. While <see cref="Status"/> is
/// <see cref="DeletionStatuses.Pending"/> the account still works (so the member can sign in and
/// keep it); after <see cref="ScheduledFor"/> the privacy job anonymises it. Rows are kept after
/// completion as the audit trail and hold no personal data beyond the (anonymised) user id.
/// </summary>
public class AccountDeletionRequest : BaseEntity
{
    public ulong TenantId { get; set; }
    public ulong UserId { get; set; }
    /// <summary>One of <see cref="DeletionStatuses"/>.</summary>
    public string Status { get; set; } = DeletionStatuses.Pending;
    /// <summary>"self" (member in the app) or "staff" (admin from member detail).</summary>
    public string Source { get; set; } = "self";
    public ulong RequestedByUserId { get; set; }
    public DateTime RequestedAt { get; set; } = DateTime.UtcNow;
    /// <summary>When the grace period ends and the account is anonymised.</summary>
    public DateTime ScheduledFor { get; set; }
    public DateTime? CancelledAt { get; set; }
    public ulong? CancelledByUserId { get; set; }
    public DateTime? CompletedAt { get; set; }
    public ulong? ProcessedByUserId { get; set; }
    /// <summary>Why it can't go ahead (money owed, order in progress) — plain text, no personal data.</summary>
    public string? BlockedReason { get; set; }
    /// <summary>Staff note (admin-initiated requests). No personal data please.</summary>
    public string? Reason { get; set; }
    /// <summary>What was done: { tables: { name: rowCount }, files: n } — counts only.</summary>
    public JsonDocument? Summary { get; set; }
}

public static class DeletionStatuses
{
    public const string Pending = "pending";
    public const string Cancelled = "cancelled";
    public const string Completed = "completed";
    /// <summary>Asked for, but money is owed or an order is in progress.</summary>
    public const string Blocked = "blocked";

    public static readonly string[] All = [Pending, Cancelled, Completed, Blocked];
}

/// <summary>A "download my data" export: a private ZIP (data.json + summary.html) in file storage.</summary>
public class DataExportRequest : BaseEntity
{
    public ulong TenantId { get; set; }
    public ulong UserId { get; set; }
    /// <summary>One of <see cref="ExportStatuses"/>.</summary>
    public string Status { get; set; } = ExportStatuses.Queued;
    public ulong RequestedByUserId { get; set; }
    public DateTime RequestedAt { get; set; } = DateTime.UtcNow;
    public DateTime? StartedAt { get; set; }
    public DateTime? ReadyAt { get; set; }
    /// <summary>The download link stops working after this (7 days after it was ready); the file is then deleted.</summary>
    public DateTime? ExpiresAt { get; set; }
    /// <summary>Private storage URL; only opened through a signed link. Null once expired.</summary>
    public string? FileUrl { get; set; }
    public long? SizeBytes { get; set; }
    public int Attempts { get; set; }
    public string? Error { get; set; }
}

public static class ExportStatuses
{
    public const string Queued = "queued";
    public const string Preparing = "preparing";
    public const string Ready = "ready";
    public const string Expired = "expired";
    public const string Failed = "failed";
}
