using GymManagmentApplication.Domain.Entities.Safety;

namespace GymManagmentApplication.Domain.Entities.Facilities;

// Gym-floor facilities (roadmap feature 7): the equipment register with out-of-service status and
// service history, members' / trainers' problem reports and the staff incident log.
// Mapping: Infrastructure/Data/Configurations/FacilitiesConfigurations.cs. Every table has a ulong
// TenantId, so AppDbContext's global tenant filter applies automatically.
//
// FacilityAsset is a physical machine / area on the floor ("Treadmill 3", "Pool"). It is NOT the
// exercise library's Equipment (an equipment *type* exercises use); an asset may point at one.

public enum AssetStatus { InService, Limited, OutOfService }

/// <summary>One machine or area of a branch's floor.</summary>
public class FacilityAsset : BaseEntity
{
    public ulong TenantId { get; set; }
    public ulong BranchId { get; set; }
    public string Name { get; set; } = default!;
    /// <summary>Free text kind: "Treadmill", "Squat rack", "Pool", "Sauna".</summary>
    public string? AssetType { get; set; }
    /// <summary>Optional link to the exercise library's equipment type (Equipment.Id is a ushort).</summary>
    public ushort? EquipmentId { get; set; }
    /// <summary>Zone / area of the floor: "Cardio", "Free weights", "Wellness".</summary>
    public string? Zone { get; set; }
    public string? PhotoUrl { get; set; }
    public string? SerialNumber { get; set; }
    /// <summary>Printed on the machine's QR label; unique per gym. Generated when left empty.</summary>
    public string AssetCode { get; set; } = default!;
    /// <summary>A facility members plan around (pool, sauna): going out of service offers a service-status notice.</summary>
    public bool IsKeyFacility { get; set; }
    public AssetStatus Status { get; set; } = AssetStatus.InService;
    public string? StatusReason { get; set; }
    public DateTime StatusSince { get; set; } = DateTime.UtcNow;
    /// <summary>Expected back in service (branch-local date), shown to members as "back ~Fri".</summary>
    public DateOnly? ExpectedBackOn { get; set; }
    public ulong? StatusChangedByUserId { get; set; }
    /// <summary>The service-status notice posted when this key facility went out of service (ended when it is back).</summary>
    public ulong? ServiceStatusId { get; set; }
    public DateOnly? LastServicedOn { get; set; }
    public DateOnly? NextServiceDue { get; set; }
    public string? Notes { get; set; }
    /// <summary>Removed from the floor; kept for its history and reports.</summary>
    public DateTime? ArchivedAt { get; set; }
    public ulong? CreatedByUserId { get; set; }
}

/// <summary>One maintenance / service visit of an asset.</summary>
public class FacilityMaintenance : BaseEntity
{
    public ulong TenantId { get; set; }
    public ulong AssetId { get; set; }
    public DateOnly PerformedOn { get; set; }
    public string Work { get; set; } = default!;
    /// <summary>Technician or company (free text; staff picked in the app are stored by name too).</summary>
    public string? PerformedBy { get; set; }
    public decimal? Cost { get; set; }
    public DateOnly? NextServiceDue { get; set; }
    public ulong? CreatedByUserId { get; set; }
}

public static class ProblemTypes
{
    public const string Broken = "broken";
    public const string Damaged = "damaged";
    public const string Unsafe = "unsafe";
    public const string Dirty = "dirty";
    public const string MissingPart = "missing_part";
    public const string Other = "other";

    public static readonly string[] All = [Broken, Damaged, Unsafe, Dirty, MissingPart, Other];

    public static string Label(string type) => type switch
    {
        Broken => "Broken", Damaged => "Damaged", Unsafe => "Unsafe", Dirty => "Dirty", MissingPart => "Missing part", _ => "Other",
    };
}

public enum ReportStatus { Received, InProgress, Fixed, CantReproduce }

/// <summary>A member's / trainer's / staff member's "something is wrong with this" report.</summary>
public class FacilityReport : BaseEntity
{
    public ulong TenantId { get; set; }
    public ulong BranchId { get; set; }
    /// <summary>Null = "Something else" (see <see cref="OtherLocation"/>), or not linked yet.</summary>
    public ulong? AssetId { get; set; }
    /// <summary>Free text for "Something else": "Women's changing room shower 2".</summary>
    public string? OtherLocation { get; set; }
    /// <summary>One of <see cref="ProblemTypes"/>.</summary>
    public string ProblemType { get; set; } = ProblemTypes.Other;
    public string? Description { get; set; }
    /// <summary>Up to 3 photo URLs, newline-separated.</summary>
    public string? PhotoUrls { get; set; }
    public ulong ReporterUserId { get; set; }
    public ReportStatus Status { get; set; } = ReportStatus.Received;
    /// <summary>Unsafe reports (or staff-flagged): urgent push to staff, top of the queue.</summary>
    public bool IsUrgent { get; set; }
    public ulong? AssignedToUserId { get; set; }
    public string? ResolutionNote { get; set; }
    public DateTime? ResolvedAt { get; set; }
    public ulong? ResolvedByUserId { get; set; }
    /// <summary>Others who said "me too" (FacilityReportFollowers).</summary>
    public int PlusOneCount { get; set; }
    public DateTime LastActivityAt { get; set; } = DateTime.UtcNow;
}

/// <summary>Someone who +1'd a report: hears when it is fixed. Key: (ReportId, UserId).</summary>
public class FacilityReportFollower
{
    public ulong ReportId { get; set; }
    public ulong UserId { get; set; }
    public ulong TenantId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>A comment on a report (reporter, a +1-er or staff). Staff notes can be internal.</summary>
public class FacilityReportComment
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public ulong ReportId { get; set; }
    public ulong UserId { get; set; }
    public string Body { get; set; } = default!;
    public bool IsStaff { get; set; }
    /// <summary>Staff-only note, never shown to members.</summary>
    public bool IsInternal { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public static class IncidentTypes
{
    public const string Injury = "injury";
    public const string Medical = "medical";
    public const string NearMiss = "near_miss";
    public const string PropertyDamage = "property_damage";
    public const string Security = "security";
    public const string Other = "other";

    public static readonly string[] All = [Injury, Medical, NearMiss, PropertyDamage, Security, Other];

    public static string Label(string type) => type switch
    {
        Injury => "Injury", Medical => "Medical", NearMiss => "Near miss", PropertyDamage => "Property damage", Security => "Security", _ => "Other",
    };
}

public enum IncidentSeverity { Low, Medium, High, Critical }
public enum IncidentStatus { Open, Closed }

/// <summary>
/// A staff-only record of something that happened at the gym (injury, medical, near miss…).
/// Editable while Open; once Closed it is a legal record: never changed again (enforced on
/// SaveChanges by AppendOnlyGuard) — later information goes into <see cref="IncidentAddendum"/>s.
/// Every view and change is written to the AuditLog (EntityType "Incident").
/// </summary>
public class Incident : BaseEntity
{
    public ulong TenantId { get; set; }
    public ulong BranchId { get; set; }
    public DateTime OccurredAt { get; set; }
    /// <summary>Where in the branch: "Free weights, by the squat racks".</summary>
    public string Location { get; set; } = default!;
    /// <summary>One of <see cref="IncidentTypes"/>.</summary>
    public string Type { get; set; } = IncidentTypes.Other;
    public IncidentSeverity Severity { get; set; } = IncidentSeverity.Low;
    public string Description { get; set; } = default!;
    public bool FirstAidGiven { get; set; }
    public string? FirstAidBy { get; set; }
    public bool AmbulanceCalled { get; set; }
    /// <summary>Witness names and contacts, free text.</summary>
    public string? Witnesses { get; set; }
    public string? FollowUpActions { get; set; }
    /// <summary>Attachment URLs (private documents / photos), newline-separated.</summary>
    public string? AttachmentUrls { get; set; }
    /// <summary>Optional link to the equipment involved.</summary>
    public ulong? AssetId { get; set; }
    public IncidentStatus Status { get; set; } = IncidentStatus.Open;
    public DateTime? ClosedAt { get; set; }
    public ulong? ClosedByUserId { get; set; }
    public string? ClosureNote { get; set; }
    public ulong ReportedByUserId { get; set; }

    public List<IncidentPerson> People { get; set; } = [];
}

public static class IncidentPersonKinds
{
    public const string Member = "member";
    public const string Staff = "staff";
    public const string Visitor = "visitor";
    public static readonly string[] All = [Member, Staff, Visitor];
}

/// <summary>Someone involved in an incident: a linked member / staff user or a visitor by name.</summary>
public class IncidentPerson
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public ulong IncidentId { get; set; }
    /// <summary>One of <see cref="IncidentPersonKinds"/>.</summary>
    public string Kind { get; set; } = IncidentPersonKinds.Visitor;
    /// <summary>Linked member / staff account (null for visitors).</summary>
    public ulong? UserId { get; set; }
    /// <summary>Name at the time (snapshot; replaced by the anonymised reference when the member is deleted).</summary>
    public string Name { get; set; } = default!;
    public string? Contact { get; set; }
    /// <summary>The injured / affected party (decides whether it appears in their data export).</summary>
    public bool IsInjuredParty { get; set; }
    public string? Notes { get; set; }
}

/// <summary>Information added after the fact. Append-only (never changed or deleted).</summary>
public class IncidentAddendum : IAppendOnly
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public ulong IncidentId { get; set; }
    public string Body { get; set; } = default!;
    public ulong AuthorUserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
