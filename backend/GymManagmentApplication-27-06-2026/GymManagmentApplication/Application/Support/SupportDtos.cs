namespace GymManagmentApplication.Application.Support;

// ── Requests ────────────────────────────────────────────────────────────────

public class CreateSupportRequestBody
{
    public string? Category { get; set; }
    public string? Subject { get; set; }
    public string? Message { get; set; }
    /// <summary>Up to 3 URLs from POST /api/uploads (this gym's files only).</summary>
    public List<string>? Photos { get; set; }
    public ulong? BranchId { get; set; }
    public bool CanContact { get; set; }
    /// <summary>app | email | phone (when <see cref="CanContact"/>).</summary>
    public string? ContactMethod { get; set; }
}

public class SupportReplyBody
{
    public string? Body { get; set; }
    public List<string>? Photos { get; set; }
    /// <summary>Staff only: an internal note (never shown to the member).</summary>
    public bool Internal { get; set; }
    /// <summary>Staff only: status after replying — waiting (default), open, resolved or closed. Ignored for notes.</summary>
    public string? Status { get; set; }
}

public class RateSupportBody
{
    public int Score { get; set; }
    public string? Comment { get; set; }
}

public class ReopenSupportBody
{
    public string? Message { get; set; }
}

public class AssignSupportBody
{
    /// <summary>null = unassign.</summary>
    public ulong? AssigneeId { get; set; }
}

public class SupportPriorityBody
{
    public string? Priority { get; set; }
}

public class SupportStatusBody
{
    public string? Status { get; set; }
}

public class SupportQueueFilter
{
    /// <summary>active (open + waiting, default) | open | waiting | resolved | closed | all.</summary>
    public string? Status { get; set; }
    public string? Category { get; set; }
    /// <summary>"me", "none" (unassigned) or a user id.</summary>
    public string? Assignee { get; set; }
    public ulong? BranchId { get; set; }
    public string? Priority { get; set; }
    public string? Search { get; set; }
    public bool Overdue { get; set; }
    public ulong? MemberId { get; set; }
    public int Page { get; set; } = 1;
    public int Size { get; set; } = 20;
}

public class SupportSlaDto
{
    public string FirstResponse { get; set; } = SlaStates.None;
    public DateTime FirstResponseDueAt { get; set; }
    public string Resolution { get; set; } = SlaStates.None;
    public DateTime ResolutionDueAt { get; set; }
    public bool Overdue { get; set; }
    public bool DueSoon { get; set; }

    public static SupportSlaDto From(SlaInfo s) => new()
    {
        FirstResponse = s.FirstResponse.State, FirstResponseDueAt = s.FirstResponse.DueAt,
        Resolution = s.Resolution.State, ResolutionDueAt = s.Resolution.DueAt,
        Overdue = s.Overdue, DueSoon = s.DueSoon,
    };
}

/// <summary>A request as a list row (member and staff).</summary>
public class SupportRequestSummary
{
    public ulong Id { get; set; }
    public string Category { get; set; } = "";
    public string CategoryLabel { get; set; } = "";
    public string Subject { get; set; } = "";
    public string Status { get; set; } = "";
    public string Priority { get; set; } = "";
    public DateTime CreatedAt { get; set; }
    public DateTime LastMessageAt { get; set; }
    public string? LastMessageBy { get; set; }
    /// <summary>First line of the latest message the caller may see.</summary>
    public string? Preview { get; set; }
    public ulong? BranchId { get; set; }
    public string? BranchName { get; set; }
    public byte? Rating { get; set; }

    // Staff only (null for the member).
    public ulong? MemberId { get; set; }
    public string? MemberName { get; set; }
    public ulong? AssigneeId { get; set; }
    public string? AssigneeName { get; set; }
    public SupportSlaDto? Sla { get; set; }
}

public class SupportMessageDto
{
    public ulong Id { get; set; }
    public string Kind { get; set; } = "";
    public string AuthorRole { get; set; } = "";
    public ulong? AuthorId { get; set; }
    public string? AuthorName { get; set; }
    public bool IsInternal { get; set; }
    public bool Mine { get; set; }
    public string Body { get; set; } = "";
    public List<string> Photos { get; set; } = [];
    public DateTime CreatedAt { get; set; }
}

public class SupportRequestDetail : SupportRequestSummary
{
    public bool CanContact { get; set; }
    public string? ContactMethod { get; set; }
    public DateTime? FirstResponseAt { get; set; }
    public DateTime? ResolvedAt { get; set; }
    public DateTime? ClosedAt { get; set; }
    public int ReopenCount { get; set; }
    public string? RatingComment { get; set; }
    public List<SupportMessageDto> Messages { get; set; } = [];

    // What the member can do now.
    public bool CanReply { get; set; }
    public bool CanRate { get; set; }
    public bool CanReopen { get; set; }
    /// <summary>Reopen is possible until then (resolved + 7 days).</summary>
    public DateTime? ReopenUntil { get; set; }

    // Staff only.
    public string? MemberEmail { get; set; }
    public string? MemberPhone { get; set; }
    public int MemberOtherRequests { get; set; }
}

public class SupportCountResponse
{
    public int Unassigned { get; set; }
    public int Overdue { get; set; }
    public int Open { get; set; }
    public int Mine { get; set; }
    /// <summary>What the More / Home badge shows: unassigned + overdue (each request once).</summary>
    public int Badge { get; set; }
}

public class SupportStaffOption
{
    public ulong Id { get; set; }
    public string Name { get; set; } = "";
    public string Role { get; set; } = "";
}

// ── Help centre ────────────────────────────────────────────────────────────

public class SupportCategoryDto
{
    public string Key { get; set; } = "";
    public string Label { get; set; } = "";
}

public class SupportFaqDto
{
    public ulong Id { get; set; }
    public string Question { get; set; } = "";
    public string Answer { get; set; } = "";
    public string? Category { get; set; }
    public int SortOrder { get; set; }
    public bool IsPublished { get; set; }
}

public class SupportFaqBody
{
    public string? Question { get; set; }
    public string? Answer { get; set; }
    public string? Category { get; set; }
    public int? SortOrder { get; set; }
    public bool IsPublished { get; set; } = true;
}

public class SupportCannedReplyDto
{
    public ulong Id { get; set; }
    public string Title { get; set; } = "";
    public string Body { get; set; } = "";
    public int SortOrder { get; set; }
}

public class SupportCannedReplyBody
{
    public string? Title { get; set; }
    public string? Body { get; set; }
    public int? SortOrder { get; set; }
}

/// <summary>The member's Help & feedback home: FAQ, categories, open request count.</summary>
public class HelpCentreResponse
{
    public List<SupportFaqDto> Faqs { get; set; } = [];
    public List<SupportCategoryDto> Categories { get; set; } = [];
    public bool RequestsEnabled { get; set; }
    public int OpenRequests { get; set; }
    /// <summary>Requests waiting on the member's reply.</summary>
    public int WaitingOnYou { get; set; }
    public int FirstResponseHours { get; set; }
}

// ── Class feedback ─────────────────────────────────────────────────────────

/// <summary>The attended class Home asks about (null when there is nothing to ask).</summary>
public class PendingClassFeedback
{
    public ulong BookingId { get; set; }
    public ulong ClassId { get; set; }
    public string ClassName { get; set; } = "";
    public string? TrainerName { get; set; }
    public DateTime StartsAt { get; set; }
}

public class ClassFeedbackBody
{
    public ulong BookingId { get; set; }
    /// <summary>1–5; ignored when <see cref="Skip"/>.</summary>
    public int? Score { get; set; }
    public string? Comment { get; set; }
    public bool Skip { get; set; }
}

public class FeedbackAverage
{
    public ulong Id { get; set; }
    public string Name { get; set; } = "";
    public double Average { get; set; }
    public int Count { get; set; }
}

public class FeedbackComment
{
    public string ClassName { get; set; } = "";
    public string? TrainerName { get; set; }
    public int Score { get; set; }
    public string Comment { get; set; } = "";
    public DateTime At { get; set; }
}

public class ClassFeedbackSummary
{
    public int Days { get; set; }
    public double Average { get; set; }
    public int Count { get; set; }
    public List<FeedbackAverage> ByClassType { get; set; } = [];
    public List<FeedbackAverage> ByTrainer { get; set; } = [];
    public List<FeedbackComment> RecentComments { get; set; } = [];
    /// <summary>Support satisfaction (resolved requests' ratings) over the same period.</summary>
    public double SupportAverage { get; set; }
    public int SupportRatings { get; set; }
}
