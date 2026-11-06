namespace GymManagmentApplication.Domain.Entities.Operations;

// Gym operations (roadmap feature 5): opening hours, holiday closures, service status and
// announcements. Mapping: Infrastructure/Data/Configurations/OperationsConfigurations.cs.
// Every table has a ulong TenantId, so AppDbContext's global tenant filter applies automatically.

/// <summary>
/// One opening interval of a branch's regular week, in the branch's own time zone. A day may have
/// several (e.g. 06:00–12:00 and 16:00–22:00); a day with none is closed. When
/// <see cref="ClosesAt"/> is at or before <see cref="OpensAt"/> the interval runs past midnight
/// (22:00–02:00 closes at 2am the next day; 00:00–00:00 is open 24 hours).
/// </summary>
public class BranchOpeningInterval : BaseEntity
{
    public ulong TenantId { get; set; }
    public ulong BranchId { get; set; }
    /// <summary>The day the interval starts on.</summary>
    public DayOfWeek DayOfWeek { get; set; }
    public TimeOnly OpensAt { get; set; }
    public TimeOnly ClosesAt { get; set; }
}

/// <summary>
/// A date whose hours differ from the regular week: a holiday closure or special hours. Replaces
/// the regular intervals that start on that local date (an overnight interval from the day before
/// still runs into it).
/// </summary>
public class BranchHoursException : BaseEntity
{
    public ulong TenantId { get; set; }
    public ulong BranchId { get; set; }
    public DateOnly Date { get; set; }
    public bool IsClosed { get; set; }
    /// <summary>Special hours when not closed: "HH:mm-HH:mm" intervals separated by commas, e.g. "08:00-12:00,16:00-20:00".</summary>
    public string? Intervals { get; set; }
    /// <summary>Shown to members, e.g. "Diwali — closed", "Christmas Eve: short day".</summary>
    public string? Note { get; set; }
}

/// <summary>Member-facing branch details that have no column on Branch: amenities and accessibility notes.</summary>
public class BranchProfile : BaseEntity
{
    public ulong TenantId { get; set; }
    public ulong BranchId { get; set; }
    /// <summary>Plain text / light markdown (bullets, bold).</summary>
    public string? Amenities { get; set; }
    public string? Accessibility { get; set; }
    public ulong? UpdatedByUserId { get; set; }
}

public enum ServiceStatusLevel { Normal, Limited, Closed }
public enum ServiceStatusSeverity { Info, Warning, Critical }

/// <summary>
/// A notice about a branch (or one area of it: "Pool", "Sauna", "Cardio floor") being limited or
/// closed, e.g. "Pool closed for maintenance until Friday". Shown while StartsAt ≤ now &lt; EndsAt;
/// it simply stops showing after EndsAt (no job needed).
/// </summary>
public class ServiceStatus : BaseEntity
{
    public ulong TenantId { get; set; }
    /// <summary>Null = every branch of the gym.</summary>
    public ulong? BranchId { get; set; }
    /// <summary>Facility area; null = the whole branch.</summary>
    public string? Area { get; set; }
    public ServiceStatusLevel Status { get; set; } = ServiceStatusLevel.Limited;
    public ServiceStatusSeverity Severity { get; set; } = ServiceStatusSeverity.Warning;
    public string Message { get; set; } = default!;
    public DateTime StartsAt { get; set; } = DateTime.UtcNow;
    /// <summary>Null = until someone ends it.</summary>
    public DateTime? EndsAt { get; set; }
    public ulong? CreatedByUserId { get; set; }
}

public enum AnnouncementAudience { AllMembers, Branches, Plans, Tags, Staff }
public enum AnnouncementStatus { Draft, Scheduled, Publishing, Published, Cancelled }

/// <summary>
/// A message from the gym to a chosen audience. Publishing (now, or at <see cref="PublishAt"/> by
/// the publish job) resolves the audience in pages of users not yet delivered to and saves each
/// page's <see cref="AnnouncementRecipient"/> rows + in-app notifications together, so an
/// interrupted run resumes where it stopped and never notifies anyone twice.
/// </summary>
public class Announcement : BaseEntity
{
    public ulong TenantId { get; set; }
    public string Title { get; set; } = default!;
    /// <summary>Plain text / light markdown.</summary>
    public string Body { get; set; } = default!;
    public string? ImageUrl { get; set; }
    /// <summary>Button text, e.g. "Book now".</summary>
    public string? CtaLabel { get; set; }
    /// <summary>App route the button opens, e.g. "book", "shop", "challenges".</summary>
    public string? CtaRoute { get; set; }
    public AnnouncementAudience Audience { get; set; } = AnnouncementAudience.AllMembers;
    /// <summary>Branch / plan / tag ids for those audiences, comma-separated.</summary>
    public string? AudienceIds { get; set; }
    public bool IsPinned { get; set; }
    public bool IsUrgent { get; set; }
    public AnnouncementStatus Status { get; set; } = AnnouncementStatus.Draft;
    /// <summary>When it goes out (UTC); null with Status Draft.</summary>
    public DateTime? PublishAt { get; set; }
    public DateTime? PublishedAt { get; set; }
    /// <summary>Hidden from feeds after this (UTC).</summary>
    public DateTime? ExpiresAt { get; set; }
    /// <summary>Lease: the publisher holding it delivers; others skip until it lapses.</summary>
    public DateTime? DeliveryLockedUntil { get; set; }
    public int RecipientCount { get; set; }
    public ulong? CreatedByUserId { get; set; }
}

/// <summary>One person an announcement was delivered to (reach, read state and the member feed). Key: (AnnouncementId, UserId).</summary>
public class AnnouncementRecipient
{
    public ulong AnnouncementId { get; set; }
    public ulong UserId { get; set; }
    public ulong TenantId { get; set; }
    public DateTime DeliveredAt { get; set; } = DateTime.UtcNow;
    public DateTime? ReadAt { get; set; }
}
