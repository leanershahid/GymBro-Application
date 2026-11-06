namespace GymManagmentApplication.Application.Operations;

// ── Opening hours ────────────────────────────────────────────────────────────

/// <summary>"HH:mm" local times. Closes ≤ Opens = past midnight ("22:00"–"02:00"); "00:00"–"00:00" = 24 hours.</summary>
public class IntervalDto
{
    public string Opens { get; set; } = default!;
    public string Closes { get; set; } = default!;
}

public class WeekdayHoursDto
{
    /// <summary>0 = Sunday … 6 = Saturday (System.DayOfWeek).</summary>
    public int Day { get; set; }
    public string DayName { get; set; } = "";
    /// <summary>Empty = closed that day.</summary>
    public List<IntervalDto> Intervals { get; set; } = [];
}

public class HoursExceptionDto
{
    public ulong Id { get; set; }
    public DateOnly Date { get; set; }
    public bool IsClosed { get; set; }
    public List<IntervalDto> Intervals { get; set; } = [];
    public string? Note { get; set; }
}

/// <summary>What the admin editor loads.</summary>
public class BranchHoursConfigResponse
{
    public ulong BranchId { get; set; }
    public string BranchName { get; set; } = default!;
    public string Timezone { get; set; } = default!;
    /// <summary>Always 7 rows, Monday first.</summary>
    public List<WeekdayHoursDto> Weekly { get; set; } = [];
    /// <summary>From yesterday on, by date.</summary>
    public List<HoursExceptionDto> Exceptions { get; set; } = [];
    public string? Amenities { get; set; }
    public string? Accessibility { get; set; }
}

public class SetWeeklyHoursRequest
{
    /// <summary>Days not listed become closed.</summary>
    public List<WeekdayHoursDto> Days { get; set; } = [];
}

public class UpsertHoursExceptionRequest
{
    public DateOnly Date { get; set; }
    public bool IsClosed { get; set; } = true;
    public List<IntervalDto> Intervals { get; set; } = [];
    public string? Note { get; set; }
}

public class OpenStatusDto
{
    public bool IsOpen { get; set; }
    /// <summary>"open", "closing_soon", "opening_soon", "closed", "unknown".</summary>
    public string State { get; set; } = default!;
    /// <summary>"Open · closes 10pm", "Closed · opens 6am Mon".</summary>
    public string Label { get; set; } = default!;
    public DateTime? ClosesAt { get; set; }
    public DateTime? OpensAt { get; set; }
    public string? Note { get; set; }
}

public class HoursDayDto
{
    public DateOnly Date { get; set; }
    /// <summary>"Today", "Tomorrow", "Wed".</summary>
    public string DayLabel { get; set; } = default!;
    public bool IsClosed { get; set; }
    /// <summary>Display-ready, e.g. "6am – 10pm".</summary>
    public List<string> Intervals { get; set; } = [];
    public string? Note { get; set; }
    public bool IsException { get; set; }
    public bool IsToday { get; set; }
}

/// <summary>GET /api/branches/{id}/hours.</summary>
public class BranchHoursResponse
{
    public ulong BranchId { get; set; }
    public string BranchName { get; set; } = default!;
    public string Timezone { get; set; } = default!;
    public bool HasHours { get; set; }
    public OpenStatusDto Today { get; set; } = default!;
    public List<HoursDayDto> Days { get; set; } = [];
}

public class BranchProfileRequest
{
    public string? Amenities { get; set; }
    public string? Accessibility { get; set; }
}

/// <summary>Member branch info screen.</summary>
public class BranchInfoResponse
{
    public ulong Id { get; set; }
    public string Name { get; set; } = default!;
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? Country { get; set; }
    public string? Zip { get; set; }
    /// <summary>One line, for display and the maps query.</summary>
    public string? FullAddress { get; set; }
    public decimal? Lat { get; set; }
    public decimal? Lng { get; set; }
    /// <summary>Opens Google Maps (web and phones); the app may prefer the platform maps app.</summary>
    public string? MapsUrl { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? LogoUrl { get; set; }
    public string? Amenities { get; set; }
    public string? Accessibility { get; set; }
    public BranchHoursResponse Hours { get; set; } = default!;
    public List<ServiceStatusDto> Statuses { get; set; } = [];
}

public class BranchDirectoryItem
{
    public ulong Id { get; set; }
    public string Name { get; set; } = default!;
    public string? City { get; set; }
    public bool IsMine { get; set; }
    public OpenStatusDto Today { get; set; } = default!;
}

public class OperationsSettings
{
    /// <summary>Members can't check themselves in (app / location) while their branch is closed. Desk check-in still works.</summary>
    public bool BlockSelfCheckInOutsideHours { get; set; }
}

// ── Service status ──────────────────────────────────────────────────────────

public class ServiceStatusDto
{
    public ulong Id { get; set; }
    public ulong? BranchId { get; set; }
    public string? BranchName { get; set; }
    public string? Area { get; set; }
    /// <summary>"Normal", "Limited", "Closed".</summary>
    public string Status { get; set; } = default!;
    /// <summary>"Info", "Warning", "Critical".</summary>
    public string Severity { get; set; } = default!;
    public string Message { get; set; } = default!;
    public DateTime StartsAt { get; set; }
    public DateTime? EndsAt { get; set; }
    /// <summary>Showing right now.</summary>
    public bool IsActive { get; set; }
    /// <summary>"Pool · Closed", "Downtown · Limited".</summary>
    public string Headline { get; set; } = default!;
}

public class ServiceStatusRequest
{
    public ulong? BranchId { get; set; }
    public string? Area { get; set; }
    public string Status { get; set; } = "Limited";
    public string Severity { get; set; } = "Warning";
    public string Message { get; set; } = default!;
    /// <summary>Null = now.</summary>
    public DateTime? StartsAt { get; set; }
    public DateTime? EndsAt { get; set; }
}

// ── Announcements ───────────────────────────────────────────────────────────

public class AnnouncementRequest
{
    public string Title { get; set; } = default!;
    public string Body { get; set; } = default!;
    public string? ImageUrl { get; set; }
    public string? CtaLabel { get; set; }
    public string? CtaRoute { get; set; }
    /// <summary>"AllMembers", "Branches", "Plans", "Tags", "Staff".</summary>
    public string Audience { get; set; } = "AllMembers";
    public List<ulong> AudienceIds { get; set; } = [];
    public bool IsPinned { get; set; }
    public bool IsUrgent { get; set; }
    /// <summary>Scheduled send time (UTC); used when <see cref="Action"/> is "schedule".</summary>
    public DateTime? PublishAt { get; set; }
    public DateTime? ExpiresAt { get; set; }
    /// <summary>"draft" (save only), "schedule" (send at PublishAt) or "publish" (send now).</summary>
    public string Action { get; set; } = "draft";
}

public class AudiencePreviewRequest
{
    public string Audience { get; set; } = "AllMembers";
    public List<ulong> AudienceIds { get; set; } = [];
}

public class AnnouncementAdminDto
{
    public ulong Id { get; set; }
    public string Title { get; set; } = default!;
    public string Body { get; set; } = default!;
    public string? ImageUrl { get; set; }
    public string? CtaLabel { get; set; }
    public string? CtaRoute { get; set; }
    public string Audience { get; set; } = default!;
    public List<ulong> AudienceIds { get; set; } = [];
    /// <summary>"All members", "2 branches", "Gold plan"…</summary>
    public string AudienceLabel { get; set; } = default!;
    public bool IsPinned { get; set; }
    public bool IsUrgent { get; set; }
    /// <summary>"Draft", "Scheduled", "Publishing", "Published", "Cancelled"; "Expired" when published and past ExpiresAt.</summary>
    public string Status { get; set; } = default!;
    public DateTime? PublishAt { get; set; }
    public DateTime? PublishedAt { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public int RecipientCount { get; set; }
    public int ReadCount { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class AnnouncementFeedItem
{
    public ulong Id { get; set; }
    public string Title { get; set; } = default!;
    public string Body { get; set; } = default!;
    public string? ImageUrl { get; set; }
    public string? CtaLabel { get; set; }
    public string? CtaRoute { get; set; }
    public bool IsPinned { get; set; }
    public bool IsUrgent { get; set; }
    public DateTime PublishedAt { get; set; }
    public bool IsRead { get; set; }
}

public class AnnouncementFeedResponse
{
    public List<AnnouncementFeedItem> Items { get; set; } = [];
    public int UnreadCount { get; set; }
    public int PageNumber { get; set; }
    public bool HasMore { get; set; }
}

public sealed record IdName(ulong Id, string Name);

public class AudienceOptionsResponse
{
    public List<IdName> Branches { get; set; } = [];
    public List<IdName> Plans { get; set; } = [];
    public List<IdName> Tags { get; set; } = [];
}
