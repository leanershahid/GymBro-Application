namespace GymManagmentApplication.Application.Facilities;

// ── Gym settings ────────────────────────────────────────────────────────────

/// <summary>Facilities settings (TenantSettings key "facilities").</summary>
public class FacilitiesSettings
{
    /// <summary>Members can send "Report a problem".</summary>
    public bool MembersCanReport { get; set; } = true;
    /// <summary>Trainers can send "Report a problem".</summary>
    public bool TrainersCanReport { get; set; } = true;
    /// <summary>Tell staff about every new report (unsafe reports are always sent, as urgent).</summary>
    public bool NotifyStaffOnEveryReport { get; set; } = true;
    /// <summary>Members see "Out of service: Treadmill 3 (back ~Fri)" on the gym info screen (non-key assets).</summary>
    public bool ShowOutOfServiceToMembers { get; set; } = true;
}

// ── Equipment register ──────────────────────────────────────────────────────

public class AssetQuery
{
    public ulong? BranchId { get; set; }
    public string? Zone { get; set; }
    /// <summary>"InService", "Limited", "OutOfService", or "down" (Limited + OutOfService).</summary>
    public string? Status { get; set; }
    public string? Q { get; set; }
    public bool IncludeArchived { get; set; }
}

public class AssetDto
{
    public ulong Id { get; set; }
    public ulong BranchId { get; set; }
    public string? BranchName { get; set; }
    public string Name { get; set; } = default!;
    public string? AssetType { get; set; }
    public ushort? EquipmentId { get; set; }
    public string? EquipmentName { get; set; }
    public string? Zone { get; set; }
    public string? PhotoUrl { get; set; }
    public string? SerialNumber { get; set; }
    public string AssetCode { get; set; } = default!;
    public bool IsKeyFacility { get; set; }
    /// <summary>"InService", "Limited", "OutOfService".</summary>
    public string Status { get; set; } = default!;
    public string? StatusReason { get; set; }
    public DateTime StatusSince { get; set; }
    public DateOnly? ExpectedBackOn { get; set; }
    public ulong? ServiceStatusId { get; set; }
    public DateOnly? LastServicedOn { get; set; }
    public DateOnly? NextServiceDue { get; set; }
    public bool ServiceOverdue { get; set; }
    public string? Notes { get; set; }
    public bool IsArchived { get; set; }
    public int OpenReports { get; set; }
}

public class AssetDetailDto : AssetDto
{
    public List<MaintenanceDto> Maintenance { get; set; } = [];
    /// <summary>Open reports first, then the latest closed ones.</summary>
    public List<StaffReportListItem> Reports { get; set; } = [];
}

public class AssetRequest
{
    public ulong BranchId { get; set; }
    public string Name { get; set; } = default!;
    public string? AssetType { get; set; }
    public ushort? EquipmentId { get; set; }
    public string? Zone { get; set; }
    public string? PhotoUrl { get; set; }
    public string? SerialNumber { get; set; }
    /// <summary>Empty = generated (e.g. "GB-7K3QXM").</summary>
    public string? AssetCode { get; set; }
    public bool IsKeyFacility { get; set; }
    public DateOnly? NextServiceDue { get; set; }
    public string? Notes { get; set; }
}

/// <summary>Adds several assets of one kind at once: either <see cref="Names"/>, or <see cref="BaseName"/> 1..<see cref="Count"/>.</summary>
public class BulkAssetRequest
{
    public ulong BranchId { get; set; }
    public string? Zone { get; set; }
    public string? AssetType { get; set; }
    public ushort? EquipmentId { get; set; }
    public bool IsKeyFacility { get; set; }
    public List<string> Names { get; set; } = [];
    /// <summary>"Treadmill" + Count 6 → "Treadmill 1" … "Treadmill 6" (numbering from <see cref="StartAt"/>).</summary>
    public string? BaseName { get; set; }
    public int Count { get; set; }
    public int StartAt { get; set; } = 1;
}

public class SetAssetStatusRequest
{
    /// <summary>"InService", "Limited", "OutOfService".</summary>
    public string Status { get; set; } = default!;
    public string? Reason { get; set; }
    public DateOnly? ExpectedBackOn { get; set; }
    /// <summary>
    /// Key facilities only: also post a service-status notice for members (the app asks first).
    /// Never posted unless this is true.
    /// </summary>
    public bool PostServiceNotice { get; set; }
    /// <summary>Notice text; default "Pool is closed: pump repair. Expected back Fri 14 Nov."</summary>
    public string? NoticeMessage { get; set; }
    /// <summary>Back in service: also close the asset's open reports as Fixed (reporters are told).</summary>
    public bool ResolveOpenReports { get; set; }
    public string? ResolutionNote { get; set; }
}

public class SetAssetStatusResponse
{
    public AssetDto Asset { get; set; } = default!;
    /// <summary>A key facility went out of service without a notice: the app may offer to post one.</summary>
    public bool OfferServiceNotice { get; set; }
    public ulong? ServiceStatusPostedId { get; set; }
    public bool ServiceStatusEnded { get; set; }
    public int ReportsResolved { get; set; }
}

public class MaintenanceDto
{
    public ulong Id { get; set; }
    public DateOnly PerformedOn { get; set; }
    public string Work { get; set; } = default!;
    public string? PerformedBy { get; set; }
    public decimal? Cost { get; set; }
    public DateOnly? NextServiceDue { get; set; }
    public string? CreatedByName { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class MaintenanceRequest
{
    public DateOnly PerformedOn { get; set; }
    public string Work { get; set; } = default!;
    public string? PerformedBy { get; set; }
    public decimal? Cost { get; set; }
    public DateOnly? NextServiceDue { get; set; }
}

// ── Member: report a problem ────────────────────────────────────────────────

public class ReportOptionsResponse
{
    public ulong BranchId { get; set; }
    public string BranchName { get; set; } = default!;
    /// <summary>False when the gym turned reporting off for the caller's role.</summary>
    public bool CanReport { get; set; }
    public List<AssetZoneGroup> Zones { get; set; } = [];
    public List<ProblemTypeOption> ProblemTypes { get; set; } = [];
    public int MaxPhotos { get; set; }
}

public class AssetZoneGroup
{
    /// <summary>"Other" for assets without a zone.</summary>
    public string Zone { get; set; } = default!;
    public List<AssetPickItem> Assets { get; set; } = [];
}

public class AssetPickItem
{
    public ulong Id { get; set; }
    public ulong BranchId { get; set; }
    public string Name { get; set; } = default!;
    public string? AssetType { get; set; }
    public string? Zone { get; set; }
    public string? PhotoUrl { get; set; }
    public string Status { get; set; } = default!;
    public DateOnly? ExpectedBackOn { get; set; }
    /// <summary>An open report exists (the app shows "Already reported" before the form).</summary>
    public bool HasOpenReport { get; set; }
}

public class ProblemTypeOption
{
    public string Key { get; set; } = default!;
    public string Label { get; set; } = default!;
    /// <summary>Unsafe: urgent for staff.</summary>
    public bool Urgent { get; set; }
}

/// <summary>Member branch info: a non-key machine that's down ("Treadmill 3 · back ~Fri").</summary>
public class OutOfServiceItem
{
    public ulong Id { get; set; }
    public string Name { get; set; } = default!;
    public string? Zone { get; set; }
    public string Status { get; set; } = default!;
    public DateOnly? ExpectedBackOn { get; set; }
}

public class CreateReportRequest
{
    public ulong BranchId { get; set; }
    /// <summary>Null = "Something else" (then <see cref="OtherLocation"/> is required).</summary>
    public ulong? AssetId { get; set; }
    public string? OtherLocation { get; set; }
    /// <summary>broken, damaged, unsafe, dirty, missing_part, other.</summary>
    public string ProblemType { get; set; } = default!;
    public string? Description { get; set; }
    /// <summary>Up to 3 URLs from POST /api/uploads.</summary>
    public List<string> PhotoUrls { get; set; } = [];
}

/// <summary>Returned (as the 409 envelope's data, code ALREADY_REPORTED) when the asset already has an open report.</summary>
public class ExistingReportDto
{
    public ulong ReportId { get; set; }
    public string AssetName { get; set; } = default!;
    public string Status { get; set; } = default!;
    public string ProblemType { get; set; } = default!;
    public int PlusOneCount { get; set; }
    public DateTime ReportedAt { get; set; }
    /// <summary>The caller reported it or already +1'd it.</summary>
    public bool AlreadyFollowing { get; set; }
    public bool IsMine { get; set; }
}

public class PlusOneRequest
{
    public string? Comment { get; set; }
    /// <summary>"It's unsafe": escalates the report to urgent.</summary>
    public bool Unsafe { get; set; }
}

public class CommentRequest
{
    public string Body { get; set; } = default!;
    /// <summary>Staff only: a note members never see.</summary>
    public bool Internal { get; set; }
}

public class ReportCommentDto
{
    public ulong Id { get; set; }
    public string Body { get; set; } = default!;
    public bool IsStaff { get; set; }
    public bool IsInternal { get; set; }
    public bool IsMine { get; set; }
    /// <summary>Members see "Gym team" for staff and "You" / "Another member"; staff see names.</summary>
    public string AuthorName { get; set; } = default!;
    public DateTime CreatedAt { get; set; }
}

public class MyReportDto
{
    public ulong Id { get; set; }
    public ulong BranchId { get; set; }
    public string? BranchName { get; set; }
    public ulong? AssetId { get; set; }
    /// <summary>Asset name or the "Something else" text.</summary>
    public string Subject { get; set; } = default!;
    public string? Zone { get; set; }
    public string ProblemType { get; set; } = default!;
    public string ProblemLabel { get; set; } = default!;
    /// <summary>"Received", "InProgress", "Fixed", "CantReproduce".</summary>
    public string Status { get; set; } = default!;
    public bool IsMine { get; set; }
    public int PlusOneCount { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? ResolvedAt { get; set; }
}

public class MyReportDetail : MyReportDto
{
    /// <summary>Only for the reporter (a +1 doesn't see someone else's text and photos).</summary>
    public string? Description { get; set; }
    public List<string> PhotoUrls { get; set; } = [];
    public string? ResolutionNote { get; set; }
    public List<ReportCommentDto> Comments { get; set; } = [];
    public bool CanComment { get; set; }
}

// ── Staff: triage queue ─────────────────────────────────────────────────────

public class ReportQuery
{
    /// <summary>"open" (default: Received + InProgress), "closed", "all", or one status.</summary>
    public string? Status { get; set; }
    public ulong? BranchId { get; set; }
    public ulong? AssetId { get; set; }
    public bool? Urgent { get; set; }
    public bool Mine { get; set; }
    public int Page { get; set; } = 1;
    public int Size { get; set; } = 30;
}

public class ReportCounts
{
    public int Open { get; set; }
    public int Urgent { get; set; }
    public int Unassigned { get; set; }
}

public class StaffReportListItem : MyReportDto
{
    public bool IsUrgent { get; set; }
    public string ReporterName { get; set; } = default!;
    public string? AssigneeName { get; set; }
    public ulong? AssignedToUserId { get; set; }
    public string? AssetStatus { get; set; }
    public int PhotoCount { get; set; }
    public DateTime LastActivityAt { get; set; }
}

public class StaffReportDetail : StaffReportListItem
{
    public string? Description { get; set; }
    public List<string> PhotoUrls { get; set; } = [];
    public string? ResolutionNote { get; set; }
    public ulong ReporterUserId { get; set; }
    public string? ReporterRole { get; set; }
    public bool AssetIsKeyFacility { get; set; }
    /// <summary>Unsafe / urgent and the linked asset is still in service: suggest marking it out of service.</summary>
    public bool SuggestOutOfService { get; set; }
    public List<ReportCommentDto> Comments { get; set; } = [];
}

public class UpdateReportRequest
{
    /// <summary>"Received", "InProgress", "Fixed", "CantReproduce"; null = unchanged.</summary>
    public string? Status { get; set; }
    /// <summary>0 = unassign; null = unchanged.</summary>
    public ulong? AssignedToUserId { get; set; }
    /// <summary>0 = unlink; null = unchanged.</summary>
    public ulong? AssetId { get; set; }
    public bool? IsUrgent { get; set; }
    /// <summary>Required for "CantReproduce"; shown to the reporter.</summary>
    public string? ResolutionNote { get; set; }
}

public class ReportOutOfServiceRequest
{
    /// <summary>"OutOfService" (default) or "Limited".</summary>
    public string Status { get; set; } = "OutOfService";
    public string? Reason { get; set; }
    public DateOnly? ExpectedBackOn { get; set; }
    /// <summary>Key facilities: also post a service-status notice (only when the user confirmed).</summary>
    public bool PostServiceNotice { get; set; }
}

public class ReportOutOfServiceResponse
{
    public StaffReportDetail Report { get; set; } = default!;
    public SetAssetStatusResponse Asset { get; set; } = default!;
}

public class StaffPickItem
{
    public ulong Id { get; set; }
    public string Name { get; set; } = default!;
    public string Role { get; set; } = default!;
}

// ── Incident log ────────────────────────────────────────────────────────────

public class IncidentQuery
{
    /// <summary>"open", "closed" or null (all).</summary>
    public string? Status { get; set; }
    public ulong? BranchId { get; set; }
    public string? Type { get; set; }
    public string? Severity { get; set; }
    public DateTime? From { get; set; }
    public DateTime? To { get; set; }
    public string? Q { get; set; }
    public int Page { get; set; } = 1;
    public int Size { get; set; } = 30;
}

public class IncidentListItem
{
    public ulong Id { get; set; }
    /// <summary>"INC-000123".</summary>
    public string Reference { get; set; } = default!;
    public DateTime OccurredAt { get; set; }
    public ulong BranchId { get; set; }
    public string? BranchName { get; set; }
    public string Location { get; set; } = default!;
    public string Type { get; set; } = default!;
    public string TypeLabel { get; set; } = default!;
    public string Severity { get; set; } = default!;
    public string Status { get; set; } = default!;
    /// <summary>"Jane Doe +1".</summary>
    public string? PeopleSummary { get; set; }
    public bool AmbulanceCalled { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class IncidentPage
{
    public List<IncidentListItem> Items { get; set; } = [];
    public int Total { get; set; }
    public int OpenCount { get; set; }
}

public class IncidentPersonDto
{
    public ulong Id { get; set; }
    public string Kind { get; set; } = default!;
    public ulong? UserId { get; set; }
    public string Name { get; set; } = default!;
    public string? Contact { get; set; }
    public bool IsInjuredParty { get; set; }
    public string? Notes { get; set; }
}

public class IncidentAddendumDto
{
    public ulong Id { get; set; }
    public string Body { get; set; } = default!;
    public string AuthorName { get; set; } = default!;
    public DateTime CreatedAt { get; set; }
}

public class IncidentDetail : IncidentListItem
{
    public string Description { get; set; } = default!;
    public bool FirstAidGiven { get; set; }
    public string? FirstAidBy { get; set; }
    public string? Witnesses { get; set; }
    public string? FollowUpActions { get; set; }
    public List<string> AttachmentUrls { get; set; } = [];
    public ulong? AssetId { get; set; }
    public string? AssetName { get; set; }
    public List<IncidentPersonDto> People { get; set; } = [];
    public List<IncidentAddendumDto> Addenda { get; set; } = [];
    public string ReportedByName { get; set; } = default!;
    public DateTime? ClosedAt { get; set; }
    public string? ClosedByName { get; set; }
    public string? ClosureNote { get; set; }
    /// <summary>Open: the fields can still be edited. Closed: addenda only.</summary>
    public bool CanEdit { get; set; }
}

public class IncidentPersonRequest
{
    /// <summary>"member", "staff" or "visitor".</summary>
    public string Kind { get; set; } = "visitor";
    /// <summary>Member / staff account; null for a visitor.</summary>
    public ulong? UserId { get; set; }
    /// <summary>Required for visitors; defaults to the account's name for linked people.</summary>
    public string? Name { get; set; }
    public string? Contact { get; set; }
    public bool IsInjuredParty { get; set; }
    public string? Notes { get; set; }
}

public class IncidentRequest
{
    public DateTime OccurredAt { get; set; }
    public ulong BranchId { get; set; }
    public string Location { get; set; } = default!;
    /// <summary>injury, medical, near_miss, property_damage, security, other.</summary>
    public string Type { get; set; } = default!;
    /// <summary>Low, Medium, High, Critical.</summary>
    public string Severity { get; set; } = "Low";
    public string Description { get; set; } = default!;
    public bool FirstAidGiven { get; set; }
    public string? FirstAidBy { get; set; }
    public bool AmbulanceCalled { get; set; }
    public string? Witnesses { get; set; }
    public string? FollowUpActions { get; set; }
    public List<string> AttachmentUrls { get; set; } = [];
    public ulong? AssetId { get; set; }
    public List<IncidentPersonRequest> People { get; set; } = [];
}

public class CloseIncidentRequest
{
    public string? ClosureNote { get; set; }
}

public class AddendumRequest
{
    public string Body { get; set; } = default!;
}

public class IncidentAuditEntry
{
    public DateTime At { get; set; }
    public string Action { get; set; } = default!;
    public string? UserName { get; set; }
    /// <summary>Fields changed (edits only) — names, never values.</summary>
    public List<string> Fields { get; set; } = [];
}

public class PersonSearchItem
{
    public ulong Id { get; set; }
    public string Name { get; set; } = default!;
    /// <summary>"member" or "staff".</summary>
    public string Kind { get; set; } = default!;
    public string? Email { get; set; }
    public string? Phone { get; set; }
}
