namespace GymManagmentApplication.Application.Safety;

// ── Settings ────────────────────────────────────────────────────────────────

/// <summary>Per-gym safety settings, stored in TenantSettings under key "safety".</summary>
public class SafetySettings
{
    /// <summary>Booking a class / PT session and self check-in need a current waiver + health check. Default OFF so existing
    /// members are not locked out on deploy: the gym switches it on (Waivers page) after announcing it.</summary>
    public bool GatingEnabled { get; set; } = false;
    /// <summary>How long a health questionnaire stays valid (days). Default 365 = yearly re-take.</summary>
    public int HealthValidDays { get; set; } = 365;
    /// <summary>Also block while a "yes" answer is awaiting medical clearance. Default off (staff are notified instead).</summary>
    public bool BlockUntilCleared { get; set; }
    /// <summary>Also require an emergency contact before booking. Default off (it is still on the checklist).</summary>
    public bool RequireEmergencyContact { get; set; }
}

// ── Requests ────────────────────────────────────────────────────────────────

public class SignWaiverRequest
{
    /// <summary>The member's full name, typed as their signature.</summary>
    public string SignedName { get; set; } = "";
    /// <summary>The "I have read and agree" checkbox.</summary>
    public bool Agreed { get; set; }
}

public class SubmitHealthRequest
{
    /// <summary>Answers to the 7 standard questions, in <see cref="HealthQuestionnaire.Questions"/> order.</summary>
    public List<bool> Answers { get; set; } = [];
    public string? Conditions { get; set; }
    public string? Medications { get; set; }
    public string? Injuries { get; set; }
    public string? Pregnancy { get; set; }
    /// <summary>Grants health-data consent in the same step when it isn't on record yet.</summary>
    public bool GrantHealthDataConsent { get; set; }
}

public class EmergencyContactRequest
{
    public string Name { get; set; } = "";
    public string? Relationship { get; set; }
    public string Phone { get; set; } = "";
}

public class RecordConsentRequest
{
    public string Type { get; set; } = "";
    public bool Granted { get; set; }
    public string? Version { get; set; }
    /// <summary>app (default), web, desk, signup.</summary>
    public string? Source { get; set; }
}

public class CreateWaiverRequest
{
    public string Title { get; set; } = "";
    public string Body { get; set; } = "";
}

public class PublishWaiverVersionRequest
{
    public string? Title { get; set; }
    public string Body { get; set; } = "";
    /// <summary>Members who signed an older version must sign this one (default true).</summary>
    public bool RequiresResign { get; set; } = true;
}

public class UpdateWaiverRequest
{
    public string? Title { get; set; }
    public bool? IsActive { get; set; }
}

public class ClearHealthRequest
{
    public string? Note { get; set; }
}

/// <summary>Who signed from where (filled by the controller from the HTTP request).</summary>
public sealed record RequestMeta(string? Ip, string? UserAgent);

// ── Responses ───────────────────────────────────────────────────────────────

public class EmergencyContactResponse
{
    public string Name { get; set; } = "";
    public string? Relationship { get; set; }
    public string Phone { get; set; } = "";
    /// <summary>"profile" = structured record; "legacy" = read from the old free-text ClientProfile field.</summary>
    public string Source { get; set; } = "profile";
    public DateTime? UpdatedAt { get; set; }
}

public class WaiverStatusResponse
{
    public ulong WaiverId { get; set; }
    public string Title { get; set; } = "";
    public ulong LatestVersionId { get; set; }
    public int LatestVersion { get; set; }
    public int? SignedVersion { get; set; }
    public DateTime? SignedAt { get; set; }
    public ulong? SignatureId { get; set; }
    /// <summary>signed · resign_required · unsigned. (A signature of an older version still counts unless a newer one requires re-signing.)</summary>
    public string Status { get; set; } = "unsigned";
    public bool Ok { get; set; }
}

public class HealthStatusResponse
{
    /// <summary>missing · current · expired · needs_clearance · cleared</summary>
    public string Status { get; set; } = "missing";
    public ulong? ScreeningId { get; set; }
    public DateTime? SubmittedAt { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public bool NeedsClearance { get; set; }
    public DateTime? ClearedAt { get; set; }
    public bool Ok { get; set; }
}

/// <summary>Everything the Get-started checklist, the gate and the admin chips need.</summary>
public class SafetyComplianceResponse
{
    public ulong UserId { get; set; }
    public bool GatingEnabled { get; set; }
    public List<WaiverStatusResponse> Waivers { get; set; } = [];
    public bool WaiverOk { get; set; }
    public HealthStatusResponse Health { get; set; } = new();
    public bool HasHealthDataConsent { get; set; }
    public EmergencyContactResponse? EmergencyContact { get; set; }
    public bool EmergencyOk { get; set; }
    /// <summary>What blocks booking: waiver, health, health_expired, clearance, emergency_contact.</summary>
    public List<string> Missing { get; set; } = [];
    public bool CanBook { get; set; }
    /// <summary>Checklist progress (waiver · health · emergency contact).</summary>
    public int StepsDone { get; set; }
    public int StepsTotal { get; set; }
    public bool ChecklistComplete { get; set; }
}

public class WaiverToSignResponse
{
    public ulong WaiverId { get; set; }
    public ulong VersionId { get; set; }
    public int Version { get; set; }
    public string Title { get; set; } = "";
    public string Body { get; set; } = "";
    public bool RequiresResign { get; set; }
    public int? PreviouslySignedVersion { get; set; }
    public DateTime PublishedAt { get; set; }
}

public class WaiverSignatureResponse
{
    public ulong Id { get; set; }
    public ulong UserId { get; set; }
    public string? MemberName { get; set; }
    public ulong WaiverId { get; set; }
    public ulong WaiverVersionId { get; set; }
    public int Version { get; set; }
    public string Title { get; set; } = "";
    public string SignedName { get; set; } = "";
    public DateTime SignedAt { get; set; }
    public string? Ip { get; set; }
    public string? UserAgent { get; set; }
    public string BodyHash { get; set; } = "";
    /// <summary>Only on the signed-copy endpoint.</summary>
    public string? Body { get; set; }
}

public class HealthQuestionResponse
{
    public string Key { get; set; } = "";
    public string Text { get; set; } = "";
    public string? Help { get; set; }
}

public class HealthQuestionnaireResponse
{
    public string FormVersion { get; set; } = "";
    public int ValidDays { get; set; }
    public List<HealthQuestionResponse> Questions { get; set; } = [];
}

public class HealthAnswerResponse
{
    public string Key { get; set; } = "";
    public string Question { get; set; } = "";
    public bool Answer { get; set; }
}

public class HealthScreeningResponse
{
    public ulong Id { get; set; }
    public ulong UserId { get; set; }
    public string FormVersion { get; set; } = "";
    public List<HealthAnswerResponse> Answers { get; set; } = [];
    public int YesCount { get; set; }
    public string? Conditions { get; set; }
    public string? Medications { get; set; }
    public string? Injuries { get; set; }
    public string? Pregnancy { get; set; }
    public bool NeedsClearance { get; set; }
    public DateTime SubmittedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public bool Expired { get; set; }
    public DateTime? ClearedAt { get; set; }
    public string? ClearanceNote { get; set; }
}

public class ConsentStateResponse
{
    public string Type { get; set; } = "";
    public bool Granted { get; set; }
    public string? Version { get; set; }
    public DateTime? At { get; set; }
    public string? Source { get; set; }
}

public class ConsentHistoryResponse
{
    public ulong Id { get; set; }
    public string Type { get; set; } = "";
    public bool Granted { get; set; }
    public string Version { get; set; } = "";
    public DateTime At { get; set; }
    public string Source { get; set; } = "";
}

public class ConsentsResponse
{
    /// <summary>One row per consent type; types never answered come back as not granted with no date.</summary>
    public List<ConsentStateResponse> Current { get; set; } = [];
    public List<ConsentHistoryResponse> History { get; set; } = [];
}

public class AdminWaiverVersionResponse
{
    public ulong Id { get; set; }
    public int Version { get; set; }
    public string Title { get; set; } = "";
    public bool RequiresResign { get; set; }
    public DateTime PublishedAt { get; set; }
    public int SignatureCount { get; set; }
}

public class AdminWaiverResponse
{
    public ulong Id { get; set; }
    public string Title { get; set; } = "";
    public bool IsActive { get; set; }
    public int LatestVersion { get; set; }
    public ulong? LatestVersionId { get; set; }
    /// <summary>Body of the latest version, for the editor.</summary>
    public string LatestBody { get; set; } = "";
    public List<AdminWaiverVersionResponse> Versions { get; set; } = [];
    public DateTime CreatedAt { get; set; }
}

public class WaiverTemplateResponse
{
    public string Title { get; set; } = "";
    public string Body { get; set; } = "";
    public bool IsPlaceholder { get; set; } = true;
}

public class SafetyOverrideResponse
{
    public ulong Id { get; set; }
    public string Context { get; set; } = "";
    public List<string> Missing { get; set; } = [];
    public string? Reason { get; set; }
    public ulong OverriddenByUserId { get; set; }
    public string? OverriddenByName { get; set; }
    public DateTime At { get; set; }
}

/// <summary>Member detail → "Waivers & health" section.</summary>
public class MemberSafetyResponse
{
    public SafetyComplianceResponse Compliance { get; set; } = new();
    public List<WaiverSignatureResponse> Signatures { get; set; } = [];
    /// <summary>Whether the caller may open the health answers (admin with the health module, or the member's trainer).</summary>
    public bool CanViewHealthAnswers { get; set; }
    public List<SafetyOverrideResponse> RecentOverrides { get; set; } = [];
    public List<ConsentStateResponse> Consents { get; set; } = [];
}
