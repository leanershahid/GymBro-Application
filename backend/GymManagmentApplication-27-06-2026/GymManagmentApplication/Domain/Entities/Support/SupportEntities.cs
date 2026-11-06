using System.Text.Json;

namespace GymManagmentApplication.Domain.Entities.Support;

// Help & feedback (roadmap feature 6): members' support requests with a conversation thread, the
// gym's FAQ and canned replies, and lightweight post-class feedback.
// Mapping: Infrastructure/Data/Configurations/SupportConfigurations.cs. Every table has a ulong
// TenantId, so AppDbContext's tenant filter applies.

/// <summary>A member's help request ("ticket"). The conversation lives in <see cref="SupportMessage"/>.</summary>
public class SupportRequest : BaseEntity
{
    public ulong TenantId { get; set; }
    /// <summary>The member who raised it.</summary>
    public ulong UserId { get; set; }
    /// <summary>The branch it is about (optional).</summary>
    public ulong? BranchId { get; set; }
    /// <summary>One of <see cref="SupportCategories"/>.</summary>
    public string Category { get; set; } = SupportCategories.Other;
    public string Subject { get; set; } = "";
    /// <summary>One of <see cref="SupportStatuses"/>.</summary>
    public string Status { get; set; } = SupportStatuses.Open;
    /// <summary>One of <see cref="SupportPriorities"/>.</summary>
    public string Priority { get; set; } = SupportPriorities.Normal;
    /// <summary>Staff member (or trainer) handling it; null = unassigned.</summary>
    public ulong? AssigneeId { get; set; }
    /// <summary>"Can we contact you?" — the member is happy to be called / emailed about it.</summary>
    public bool CanContact { get; set; }
    /// <summary>How they'd like to be contacted when <see cref="CanContact"/>: app | email | phone.</summary>
    public string? ContactMethod { get; set; }

    /// <summary>The first reply visible to the member (SLA: first response).</summary>
    public DateTime? FirstResponseAt { get; set; }
    public DateTime? ResolvedAt { get; set; }
    public DateTime? ClosedAt { get; set; }
    /// <summary>Last time the member reopened it (the resolution clock restarts from here).</summary>
    public DateTime? ReopenedAt { get; set; }
    public int ReopenCount { get; set; }
    public DateTime LastMessageAt { get; set; } = DateTime.UtcNow;
    /// <summary>Who wrote last: "member" or "staff" (unread / needs-reply hints).</summary>
    public string? LastMessageBy { get; set; }

    /// <summary>Satisfaction 1–5, once, after it was resolved.</summary>
    public byte? Rating { get; set; }
    public string? RatingComment { get; set; }
    public DateTime? RatedAt { get; set; }

    /// <summary>Set when the member's account was anonymised (privacy): their texts are redacted, the row stays for stats.</summary>
    public DateTime? RedactedAt { get; set; }

    public ICollection<SupportMessage> Messages { get; set; } = [];
}

/// <summary>One entry in a request's thread: a member / staff message, an internal note, or a status event.</summary>
public class SupportMessage : BaseEntity
{
    public ulong TenantId { get; set; }
    public ulong RequestId { get; set; }
    /// <summary>Who wrote it (null for system events).</summary>
    public ulong? AuthorId { get; set; }
    /// <summary>"member" | "staff" | "system".</summary>
    public string AuthorRole { get; set; } = SupportAuthorRoles.Member;
    /// <summary>One of <see cref="SupportMessageKinds"/>.</summary>
    public string Kind { get; set; } = SupportMessageKinds.Message;
    /// <summary>Staff-only: internal notes and assignment / priority events. Never returned to the member.</summary>
    public bool IsInternal { get; set; }
    public string Body { get; set; } = "";
    /// <summary>Up to 3 photo URLs (JSON array of strings), uploaded through /api/uploads.</summary>
    public JsonDocument? Photos { get; set; }

    public SupportRequest Request { get; set; } = default!;
}

/// <summary>A question and answer the gym shows above "Contact us".</summary>
public class SupportFaq : BaseEntity
{
    public ulong TenantId { get; set; }
    public string Question { get; set; } = "";
    public string Answer { get; set; } = "";
    /// <summary>Optional <see cref="SupportCategories"/> value, to group / suggest it.</summary>
    public string? Category { get; set; }
    public int SortOrder { get; set; }
    public bool IsPublished { get; set; } = true;
}

/// <summary>A saved staff reply ("Thanks, we've fixed it…").</summary>
public class SupportCannedReply : BaseEntity
{
    public ulong TenantId { get; set; }
    public string Title { get; set; } = "";
    public string Body { get; set; } = "";
    public int SortOrder { get; set; }
}

/// <summary>"How was {class}?" — one per attended booking (or a skip).</summary>
public class ClassFeedback : BaseEntity
{
    public ulong TenantId { get; set; }
    /// <summary>The booking it is about (unique: once per booking).</summary>
    public ulong BookingId { get; set; }
    public ulong UserId { get; set; }
    public ulong ClassId { get; set; }
    public ulong ClassTypeId { get; set; }
    /// <summary>TrainerProfile id of the class's trainer when it was rated.</summary>
    public ulong? TrainerId { get; set; }
    /// <summary>1–5; null when the member skipped.</summary>
    public byte? Score { get; set; }
    public string? Comment { get; set; }
    public bool Skipped { get; set; }
}

public static class SupportCategories
{
    public const string Billing = "billing";
    public const string Classes = "classes";
    public const string Facilities = "facilities";
    public const string Equipment = "equipment";
    public const string Staff = "staff";
    public const string App = "app";
    public const string Feedback = "feedback";
    public const string Other = "other";

    public static readonly string[] All = [Billing, Classes, Facilities, Equipment, Staff, App, Feedback, Other];

    public static string Label(string c) => c switch
    {
        Billing => "Billing & membership",
        Classes => "Classes & bookings",
        Facilities => "Facilities & cleanliness",
        Equipment => "Equipment",
        Staff => "Staff & trainers",
        App => "App problem",
        Feedback => "Feedback / idea",
        _ => "Other",
    };
}

public static class SupportStatuses
{
    public const string Open = "open";
    /// <summary>Staff replied and wait for the member ("Waiting on you").</summary>
    public const string Waiting = "waiting";
    public const string Resolved = "resolved";
    public const string Closed = "closed";

    public static readonly string[] All = [Open, Waiting, Resolved, Closed];
    public static bool IsActive(string s) => s is Open or Waiting;
}

public static class SupportPriorities
{
    public const string Low = "low";
    public const string Normal = "normal";
    public const string High = "high";
    public const string Urgent = "urgent";

    public static readonly string[] All = [Low, Normal, High, Urgent];
}

public static class SupportMessageKinds
{
    public const string Message = "message";
    /// <summary>Staff-only note (always <see cref="SupportMessage.IsInternal"/>).</summary>
    public const string Note = "note";
    /// <summary>A system line: status changed, assigned, reopened, rated.</summary>
    public const string Event = "event";
}

public static class SupportAuthorRoles
{
    public const string Member = "member";
    public const string Staff = "staff";
    public const string System = "system";
}
