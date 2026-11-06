namespace GymManagmentApplication.Application.Privacy;

/// <summary>
/// Gym settings for privacy controls (TenantSettings key <see cref="PrivacyService.SettingKey"/>).
/// The policy texts themselves are the gym's to write and host; only their links live here.
/// </summary>
public class PrivacySettings
{
    /// <summary>Days between a deletion request and the anonymisation (7–30). The member can keep the account until then.</summary>
    public int GraceDays { get; set; } = 14;
    public string? PrivacyPolicyUrl { get; set; }
    public string? TermsUrl { get; set; }
    /// <summary>"anonymise" (default: posts and comments stay, shown as "Deleted member") or "delete".</summary>
    public string SocialContentOnDeletion { get; set; } = SocialContentModes.Anonymise;
    /// <summary>When true, active memberships are cancelled when the account is deleted (no refund is made automatically).</summary>
    public bool CancelMembershipOnDeletion { get; set; }
}

public static class SocialContentModes
{
    public const string Anonymise = "anonymise";
    public const string Delete = "delete";
    public static readonly string[] All = [Anonymise, Delete];
}

public class PrivacyLinksResponse
{
    public string? PrivacyPolicyUrl { get; set; }
    public string? TermsUrl { get; set; }
    public int GraceDays { get; set; }
    public bool CancelMembershipOnDeletion { get; set; }
    public string SocialContentOnDeletion { get; set; } = SocialContentModes.Anonymise;
}

/// <summary>Something that stops (blocker) or should be read before (warning) a deletion.</summary>
public class DeletionIssue
{
    /// <summary>open_invoices · order_in_progress · active_membership · social_content.</summary>
    public string Code { get; set; } = default!;
    public string Message { get; set; } = default!;
    /// <summary>What the member can do about it, in plain words.</summary>
    public string? Action { get; set; }
    /// <summary>Screen the app can open to fix it ("billing", "shop/orders"), if any.</summary>
    public string? Route { get; set; }
}

public class DeletionCheckResponse
{
    public bool CanDelete => Blockers.Count == 0;
    public List<DeletionIssue> Blockers { get; set; } = [];
    public List<DeletionIssue> Warnings { get; set; } = [];
}

public class DeletionRequestResponse
{
    public ulong Id { get; set; }
    public string Status { get; set; } = default!;
    public string Source { get; set; } = default!;
    public DateTime RequestedAt { get; set; }
    public DateTime ScheduledFor { get; set; }
    public DateTime? CancelledAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public string? BlockedReason { get; set; }
}

/// <summary>How the member proves it's them before deleting: their password, or (no password) an emailed code; plus 2FA when on.</summary>
public class ReauthRequirements
{
    /// <summary>"password" or "email_code".</summary>
    public string Method { get; set; } = "password";
    public bool TwoFactor { get; set; }
    public bool HasEmail { get; set; }
}

public class DataExportResponse
{
    public ulong Id { get; set; }
    /// <summary>queued · preparing · ready · expired · failed.</summary>
    public string Status { get; set; } = default!;
    public DateTime RequestedAt { get; set; }
    public DateTime? ReadyAt { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public long? SizeBytes { get; set; }
}

public class PrivacyOverviewResponse
{
    public PrivacyLinksResponse Links { get; set; } = new();
    /// <summary>The open (pending or blocked) deletion request, if any.</summary>
    public DeletionRequestResponse? PendingDeletion { get; set; }
    public DeletionCheckResponse DeletionCheck { get; set; } = new();
    public ReauthRequirements Reauth { get; set; } = new();
    public List<DataExportResponse> Exports { get; set; } = [];
    /// <summary>When the next export can be requested (one per 24 hours); null = now.</summary>
    public DateTime? NextExportAt { get; set; }
}

public class RequestDeletionBody
{
    public string? Password { get; set; }
    /// <summary>The emailed code, for accounts without a password.</summary>
    public string? Code { get; set; }
    /// <summary>Authenticator or recovery code, when two-step sign-in is on.</summary>
    public string? TwoFactorCode { get; set; }
    /// <summary>The member ticked "I understand".</summary>
    public bool Confirm { get; set; }
}

public class StaffDeletionBody
{
    /// <summary>Why staff are doing it (e.g. "Asked at the desk on 3 Nov"). Required; no personal data.</summary>
    public string? Reason { get; set; }
    /// <summary>Anonymise now instead of after the grace period.</summary>
    public bool ProcessNow { get; set; }
}

public class ExportLinkResponse
{
    public string Url { get; set; } = default!;
    public DateTime ExpiresAt { get; set; }
}

public class AdminDeletionRow
{
    public ulong Id { get; set; }
    public ulong UserId { get; set; }
    public string MemberName { get; set; } = default!;
    public string Status { get; set; } = default!;
    public string Source { get; set; } = default!;
    public DateTime RequestedAt { get; set; }
    public DateTime ScheduledFor { get; set; }
    public DateTime? CancelledAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public string? BlockedReason { get; set; }
    public string? Reason { get; set; }
    public Dictionary<string, int>? Tables { get; set; }
}

public class AdminExportRow
{
    public ulong Id { get; set; }
    public ulong UserId { get; set; }
    public string MemberName { get; set; } = default!;
    public string Status { get; set; } = default!;
    public DateTime RequestedAt { get; set; }
    public DateTime? ReadyAt { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public string? Error { get; set; }
}

public class AdminPrivacyRequestsResponse
{
    public List<AdminDeletionRow> Deletions { get; set; } = [];
    public List<AdminExportRow> Exports { get; set; } = [];
}

public sealed record PrivacyRequestMeta(string? Ip, string? UserAgent);
