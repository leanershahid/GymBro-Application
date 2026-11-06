using System.Text.Json;

namespace GymManagmentApplication.Domain.Entities.Safety;

// Member safety & compliance (roadmap feature 1): waivers, health screening (PAR-Q+ style),
// structured emergency contacts and consent records. Mapping: Infrastructure/Data/Configurations/SafetyConfigurations.cs.

/// <summary>
/// Rows that are legal records: once saved they may never be updated or deleted (signatures,
/// consent grants/withdrawals, gate overrides). Enforced on SaveChanges by <c>AppendOnlyGuard</c>.
/// </summary>
public interface IAppendOnly;

/// <summary>A waiver a gym asks members to sign (e.g. "Liability waiver"). Its text lives in versions.</summary>
public class WaiverDocument : BaseEntity
{
    public ulong TenantId { get; set; }
    public string Title { get; set; } = default!;
    /// <summary>Inactive waivers are no longer asked for and never gate anything.</summary>
    public bool IsActive { get; set; } = true;
    public ulong? CreatedByUserId { get; set; }

    public List<WaiverVersion> Versions { get; set; } = [];
}

/// <summary>
/// One published text of a waiver. Immutable once created (signatures point at it): editing a
/// waiver publishes a new version. <see cref="RequiresResign"/> = members who signed an older
/// version must sign this one before they can book again.
/// </summary>
public class WaiverVersion : IAppendOnly
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public ulong WaiverId { get; set; }
    public int Version { get; set; }
    public string Title { get; set; } = default!;
    /// <summary>Plain text / light markdown (headings, bullets, bold).</summary>
    public string Body { get; set; } = default!;
    /// <summary>SHA-256 of Title + Body, so a signed copy can be proven unchanged.</summary>
    public string BodyHash { get; set; } = default!;
    public bool RequiresResign { get; set; } = true;
    public DateTime PublishedAt { get; set; } = DateTime.UtcNow;
    public ulong? PublishedByUserId { get; set; }

    public WaiverDocument Waiver { get; set; } = default!;
}

/// <summary>A member's signature of one waiver version. Immutable.</summary>
public class WaiverSignature : IAppendOnly
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public ulong UserId { get; set; }
    public ulong WaiverId { get; set; }
    public ulong WaiverVersionId { get; set; }
    /// <summary>Copy of the version number, for status chips without a join.</summary>
    public int VersionNumber { get; set; }
    /// <summary>The full name the member typed as their signature.</summary>
    public string SignedName { get; set; } = default!;
    public DateTime SignedAt { get; set; } = DateTime.UtcNow;
    public string? Ip { get; set; }
    public string? UserAgent { get; set; }
    /// <summary>The version's hash at signing time.</summary>
    public string BodyHash { get; set; } = default!;
    /// <summary>Staff member who collected it at the desk on the member's behalf (null = self-signed in app).</summary>
    public ulong? WitnessUserId { get; set; }

    public WaiverVersion WaiverVersion { get; set; } = default!;
}

/// <summary>
/// A PAR-Q+ style health questionnaire submission. Each re-take is a new row; the latest one
/// counts. Visible only to the member, admins with the health module and assigned trainers.
/// </summary>
public class HealthScreening
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public ulong UserId { get; set; }
    /// <summary>Questionnaire version, e.g. "parq-plus-v1".</summary>
    public string FormVersion { get; set; } = default!;
    /// <summary>[{ key, question, answer }] — the question text is snapshotted with the answer.</summary>
    public JsonDocument Answers { get; set; } = default!;
    public int YesCount { get; set; }
    public string? Conditions { get; set; }
    public string? Medications { get; set; }
    public string? Injuries { get; set; }
    /// <summary>Free text ("no", "yes — 20 weeks", "prefer not to say").</summary>
    public string? Pregnancy { get; set; }
    /// <summary>True when any answer is "yes": a doctor's clearance is advised before training.</summary>
    public bool NeedsClearance { get; set; }
    public DateTime SubmittedAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAt { get; set; }
    /// <summary>Set by staff once a medical clearance was received.</summary>
    public DateTime? ClearedAt { get; set; }
    public ulong? ClearedByUserId { get; set; }
    public string? ClearanceNote { get; set; }
}

/// <summary>Structured emergency contact, one per member (replaces ClientProfile.EmergencyContact, kept as fallback).</summary>
public class MemberEmergencyContact : BaseEntity
{
    public ulong TenantId { get; set; }
    public ulong UserId { get; set; }
    public string Name { get; set; } = default!;
    public string? Relationship { get; set; }
    public string Phone { get; set; } = default!;
    public ulong? UpdatedByUserId { get; set; }
}

/// <summary>One grant or withdrawal of consent. Append-only: the latest row per (user, type) is the current state.</summary>
public class ConsentRecord : IAppendOnly
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public ulong UserId { get; set; }
    /// <summary>One of <see cref="ConsentTypes"/>.</summary>
    public string Type { get; set; } = default!;
    public bool Granted { get; set; }
    /// <summary>Version of the policy / text consented to.</summary>
    public string Version { get; set; } = "1";
    public DateTime At { get; set; } = DateTime.UtcNow;
    /// <summary>Where it was given: app, web, desk, health_form, signup, import.</summary>
    public string Source { get; set; } = "app";
    public string? Ip { get; set; }
    /// <summary>Staff member who recorded it for the member (desk), else null.</summary>
    public ulong? RecordedByUserId { get; set; }
}

public static class ConsentTypes
{
    public const string HealthData = "health_data";
    public const string MarketingEmail = "marketing_email";
    public const string MarketingPush = "marketing_push";
    public const string PhotoMedia = "photo_media";
    public const string Terms = "terms";
    public const string Privacy = "privacy";

    public static readonly string[] All = [HealthData, MarketingEmail, MarketingPush, PhotoMedia, Terms, Privacy];
}

/// <summary>Staff let a member through a safety gate (desk check-in) despite a missing waiver/health check. Immutable.</summary>
public class SafetyGateOverride : IAppendOnly
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public ulong UserId { get; set; }
    public ulong OverriddenByUserId { get; set; }
    /// <summary>"desk_checkin" (others may follow).</summary>
    public string Context { get; set; } = default!;
    /// <summary>Comma-separated items that were missing: waiver, health, health_expired, clearance.</summary>
    public string Missing { get; set; } = default!;
    public string? Reason { get; set; }
    public ulong? AttendanceId { get; set; }
    public DateTime At { get; set; } = DateTime.UtcNow;
}
