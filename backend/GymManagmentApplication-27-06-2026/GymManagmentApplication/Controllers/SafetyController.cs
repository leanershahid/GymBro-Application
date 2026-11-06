using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Safety;
using GymManagmentApplication.Domain.Constants;
using GymManagmentApplication.Filters;
using Microsoft.AspNetCore.Mvc;

namespace GymManagmentApplication.Controllers;

/// <summary>
/// Waivers, health screening (PAR-Q+ style) and emergency contacts.
/// <list type="bullet">
///   <item><c>/api/safety/me/*</c> — the signed-in person's own records (any role).</item>
///   <item><c>/api/safety/members/{id}</c> — member detail for staff (members module) and assigned trainers.</item>
///   <item><c>/api/safety/members/{id}/health</c> — health answers: admin/staff with <c>health-screening</c>, or assigned trainers.</item>
///   <item><c>/api/safety/admin/*</c> — waiver documents and gating settings (<c>waivers</c> module).</item>
/// </list>
/// </summary>
[ApiController]
[Route("api/safety")]
public class SafetyController(SafetyService service) : ControllerBase
{
    private RequestMeta Meta => new(HttpContext.Connection.RemoteIpAddress?.ToString(), Request.Headers.UserAgent.ToString());

    // ── Me ───────────────────────────────────────────────────────────────────

    /// <summary>Checklist + gate status: waivers, health check, emergency contact, what blocks booking.</summary>
    [HttpGet("me")]
    [AuthorizeRoles]
    public async Task<ActionResult<ApiResponse<object>>> MyStatus()
        => Ok(ApiResponse<object>.Ok(await service.GetMyStatusAsync()));

    [HttpGet("me/waivers/pending")]
    [AuthorizeRoles]
    public async Task<ActionResult<ApiResponse<object>>> PendingWaivers()
        => Ok(ApiResponse<object>.Ok(await service.GetPendingWaiversAsync()));

    [HttpPost("me/waivers/{versionId}/sign")]
    [AuthorizeRoles]
    public async Task<ActionResult<ApiResponse<object>>> SignWaiver(ulong versionId, [FromBody] SignWaiverRequest request)
        => Ok(ApiResponse<object>.Ok(await service.SignWaiverAsync(versionId, request, Meta), "Waiver signed."));

    [HttpGet("me/signatures")]
    [AuthorizeRoles]
    public async Task<ActionResult<ApiResponse<object>>> MySignatures()
        => Ok(ApiResponse<object>.Ok(await service.GetMySignaturesAsync()));

    [HttpGet("me/health/questions")]
    [AuthorizeRoles]
    public async Task<ActionResult<ApiResponse<object>>> HealthQuestions()
        => Ok(ApiResponse<object>.Ok(await service.GetQuestionnaireAsync()));

    [HttpGet("me/health")]
    [AuthorizeRoles]
    public async Task<ActionResult<ApiResponse<object>>> MyHealth()
        => Ok(ApiResponse<object>.Ok(await service.GetMyLatestHealthAsync()));

    [HttpPost("me/health")]
    [AuthorizeRoles]
    public async Task<ActionResult<ApiResponse<object>>> SubmitHealth([FromBody] SubmitHealthRequest request)
    {
        var result = await service.SubmitHealthAsync(request, Meta);
        return Ok(ApiResponse<object>.Ok(result, result.NeedsClearance
            ? "Thanks. Because you answered yes to at least one question, please check with your doctor before training hard. The gym team has been told."
            : "Health check saved."));
    }

    [HttpGet("me/emergency-contact")]
    [AuthorizeRoles]
    public async Task<ActionResult<ApiResponse<object>>> MyEmergencyContact()
        => Ok(ApiResponse<object>.Ok(await service.GetMyEmergencyContactAsync()));

    [HttpPut("me/emergency-contact")]
    [AuthorizeRoles]
    public async Task<ActionResult<ApiResponse<object>>> SetMyEmergencyContact([FromBody] EmergencyContactRequest request)
        => Ok(ApiResponse<object>.Ok(await service.SetMyEmergencyContactAsync(request), "Emergency contact saved."));

    // ── Staff: member detail ─────────────────────────────────────────────────

    [HttpGet("members/{memberId}")]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer)]
    [PermissionModule("members")]
    [RequireModule("members")]
    public async Task<ActionResult<ApiResponse<object>>> MemberSafety(ulong memberId)
        => Ok(ApiResponse<object>.Ok(await service.GetMemberSafetyAsync(memberId)));

    /// <summary>Health answers (newest first). The service enforces the health visibility rule.</summary>
    [HttpGet("members/{memberId}/health")]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer)]
    [PermissionModule("members")]
    [RequireModule("members")]
    public async Task<ActionResult<ApiResponse<object>>> MemberHealth(ulong memberId)
        => Ok(ApiResponse<object>.Ok(await service.GetMemberHealthAsync(memberId)));

    [HttpPost("members/{memberId}/health/{screeningId}/clear")]
    [AuthorizeRoles(RoleNames.Admin)]
    [PermissionModule(SafetyService.HealthApiModule)]
    [RequireModule(SafetyService.HealthApiModule)]
    public async Task<ActionResult<ApiResponse<object>>> ClearHealth(ulong memberId, ulong screeningId, [FromBody] ClearHealthRequest? request)
        => Ok(ApiResponse<object>.Ok(await service.ClearHealthAsync(memberId, screeningId, request ?? new()), "Medical clearance recorded."));

    /// <summary>A signed waiver exactly as signed, for viewing / printing (member themself, staff, assigned trainer).</summary>
    [HttpGet("signatures/{signatureId}")]
    [AuthorizeRoles]
    public async Task<ActionResult<ApiResponse<object>>> SignedCopy(ulong signatureId)
        => Ok(ApiResponse<object>.Ok(await service.GetSignedCopyAsync(signatureId)));

    // ── Admin: waiver documents & settings ───────────────────────────────────

    [HttpGet("admin/waivers")]
    [AuthorizeRoles(RoleNames.Admin)]
    [PermissionModule("waivers")]
    [RequireModule("waivers")]
    public async Task<ActionResult<ApiResponse<object>>> Waivers()
        => Ok(ApiResponse<object>.Ok(await service.GetWaiversAsync()));

    /// <summary>The placeholder starting text (must be reviewed by a lawyer before use).</summary>
    [HttpGet("admin/waivers/template")]
    [AuthorizeRoles(RoleNames.Admin)]
    [PermissionModule("waivers")]
    [RequireModule("waivers")]
    public ActionResult<ApiResponse<object>> WaiverTemplate()
        => Ok(ApiResponse<object>.Ok(SafetyService.GetTemplate()));

    [HttpPost("admin/waivers")]
    [AuthorizeRoles(RoleNames.Admin)]
    [PermissionModule("waivers")]
    [RequireModule("waivers")]
    public async Task<ActionResult<ApiResponse<object>>> CreateWaiver([FromBody] CreateWaiverRequest request)
        => Ok(ApiResponse<object>.Ok(await service.CreateWaiverAsync(request), "Waiver published."));

    [HttpPost("admin/waivers/{waiverId}/versions")]
    [AuthorizeRoles(RoleNames.Admin)]
    [PermissionModule("waivers")]
    [RequireModule("waivers")]
    public async Task<ActionResult<ApiResponse<object>>> PublishVersion(ulong waiverId, [FromBody] PublishWaiverVersionRequest request)
        => Ok(ApiResponse<object>.Ok(await service.PublishVersionAsync(waiverId, request), "New version published."));

    [HttpPut("admin/waivers/{waiverId}")]
    [AuthorizeRoles(RoleNames.Admin)]
    [PermissionModule("waivers")]
    [RequireModule("waivers")]
    public async Task<ActionResult<ApiResponse<object>>> UpdateWaiver(ulong waiverId, [FromBody] UpdateWaiverRequest request)
        => Ok(ApiResponse<object>.Ok(await service.UpdateWaiverAsync(waiverId, request), "Waiver updated."));

    [HttpGet("admin/settings")]
    [AuthorizeRoles(RoleNames.Admin)]
    [PermissionModule("waivers")]
    [RequireModule("waivers")]
    public async Task<ActionResult<ApiResponse<object>>> Settings()
        => Ok(ApiResponse<object>.Ok(await service.GetSettingsAsync()));

    [HttpPut("admin/settings")]
    [AuthorizeRoles(RoleNames.Admin)]
    [PermissionModule("waivers")]
    [RequireModule("waivers")]
    public async Task<ActionResult<ApiResponse<object>>> UpdateSettings([FromBody] SafetySettings request)
        => Ok(ApiResponse<object>.Ok(await service.UpdateSettingsAsync(request), "Settings saved."));
}

/// <summary>
/// Consent records (append-only). The privacy screen is a later feature; for now the member's own
/// GET / POST, and staff read them through <c>/api/safety/members/{id}</c>.
/// </summary>
[ApiController]
[Route("api/consents")]
public class ConsentsController(ConsentService service) : ControllerBase
{
    [HttpGet("me")]
    [AuthorizeRoles]
    public async Task<ActionResult<ApiResponse<object>>> Mine()
        => Ok(ApiResponse<object>.Ok(await service.GetMineAsync()));

    /// <summary>Grant or withdraw one consent: { type, granted, version?, source? }.</summary>
    [HttpPost("me")]
    [AuthorizeRoles]
    public async Task<ActionResult<ApiResponse<object>>> Record([FromBody] RecordConsentRequest request)
        => Ok(ApiResponse<object>.Ok(await service.RecordMineAsync(request, HttpContext.Connection.RemoteIpAddress?.ToString()),
            request.Granted ? "Consent recorded." : "Consent withdrawn."));
}
