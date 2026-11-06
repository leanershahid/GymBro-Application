using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Privacy;
using GymManagmentApplication.Domain.Constants;
using GymManagmentApplication.Filters;
using GymManagmentApplication.Infrastructure.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace GymManagmentApplication.Controllers;

/// <summary>
/// The signed-in person's privacy controls: overview, delete my account (with a grace period and
/// "Keep my account"), download my data. Consents are <c>api/consents/me</c> (ConsentsController).
/// </summary>
[ApiController]
[Route("api/me")]
public class MyPrivacyController(PrivacyService service) : ControllerBase
{
    private PrivacyRequestMeta Meta => new(HttpContext.Connection.RemoteIpAddress?.ToString(), Request.Headers.UserAgent.ToString());

    /// <summary>Policy links, the open deletion request, what blocks deleting, how to re-authenticate, recent exports.</summary>
    [HttpGet("privacy")]
    [AuthorizeRoles]
    public async Task<ActionResult<ApiResponse<object>>> Overview()
        => Ok(ApiResponse<object>.Ok(await service.GetOverviewAsync()));

    /// <summary>The open (pending/blocked) deletion request, or null — for the app-wide "Keep my account" banner.</summary>
    [HttpGet("deletion-request")]
    [AuthorizeRoles]
    public async Task<ActionResult<ApiResponse<object?>>> MyDeletion()
        => Ok(ApiResponse<object?>.Ok(await service.GetMyDeletionAsync()));

    /// <summary>Accounts without a password: email a code that confirms the deletion.</summary>
    [HttpPost("deletion-request/code")]
    [AuthorizeRoles]
    [EnableRateLimiting(RateLimits.Auth)]
    public async Task<ActionResult<ApiResponse<object?>>> SendCode()
    {
        await service.SendDeletionCodeAsync();
        return Ok(ApiResponse<object?>.Ok(null, "We've emailed you a code."));
    }

    /// <summary>{ password | code, twoFactorCode?, confirm: true } → pending deletion; signs out everywhere.</summary>
    [HttpPost("deletion-request")]
    [AuthorizeRoles]
    [EnableRateLimiting(RateLimits.Auth)]
    public async Task<ActionResult<ApiResponse<object>>> RequestDeletion([FromBody] RequestDeletionBody body)
    {
        var result = await service.RequestMyDeletionAsync(body, Meta);
        return Ok(ApiResponse<object>.Ok(result, $"Your account will be deleted on {result.ScheduledFor:dd MMM yyyy}. Sign in before then and tap Keep my account if you change your mind."));
    }

    /// <summary>"Keep my account".</summary>
    [HttpPost("deletion-request/cancel")]
    [AuthorizeRoles]
    public async Task<ActionResult<ApiResponse<object?>>> Keep()
        => Ok(ApiResponse<object?>.Ok(await service.CancelMyDeletionAsync(), "Your account is safe. We won't delete it."));

    [HttpDelete("deletion-request")]
    [AuthorizeRoles]
    public Task<ActionResult<ApiResponse<object?>>> KeepDelete() => Keep();

    /// <summary>Starts a data export (one per 24 hours). It's prepared in the background; you're notified when it's ready.</summary>
    [HttpPost("data-export")]
    [AuthorizeRoles]
    public async Task<ActionResult<ApiResponse<object>>> RequestExport()
        => Ok(ApiResponse<object>.Ok(await service.RequestMyExportAsync(), "We're preparing your data. We'll let you know when it's ready."));

    [HttpGet("data-exports")]
    [AuthorizeRoles]
    public async Task<ActionResult<ApiResponse<object>>> Exports()
        => Ok(ApiResponse<object>.Ok(await service.GetMyExportsAsync()));

    /// <summary>A short-lived signed download link (the export itself expires 7 days after it was ready).</summary>
    [HttpGet("data-exports/{id}/link")]
    [AuthorizeRoles]
    public async Task<ActionResult<ApiResponse<object>>> ExportLink(ulong id)
        => Ok(ApiResponse<object>.Ok(await service.GetMyExportLinkAsync(id)));
}

/// <summary>Privacy requests for gym admins (<c>admin.privacy</c> module, admin only by default).</summary>
[ApiController]
[Route("api/privacy/admin")]
[AuthorizeRoles(RoleNames.Admin)]
[PermissionModule(PrivacyService.ApiModule)]
[RequireModule(PrivacyService.ApiModule)]
public class PrivacyAdminController(PrivacyService service) : ControllerBase
{
    /// <summary>Deletion requests (?status=pending|completed|blocked|cancelled) and recent data exports.</summary>
    [HttpGet("requests")]
    public async Task<ActionResult<ApiResponse<object>>> Requests([FromQuery] string? status)
        => Ok(ApiResponse<object>.Ok(await service.GetRequestsAsync(status)));

    [HttpPost("deletions/{id}/process")]
    public async Task<ActionResult<ApiResponse<object>>> ProcessNow(ulong id)
        => Ok(ApiResponse<object>.Ok(await service.ProcessNowAsync(id), "Account deleted."));

    [HttpPost("deletions/{id}/cancel")]
    public async Task<ActionResult<ApiResponse<object?>>> Cancel(ulong id)
    {
        await service.CancelRequestAsync(id);
        return Ok(ApiResponse<object?>.Ok(null, "Deletion cancelled."));
    }

    /// <summary>From member detail: { reason, processNow } — schedules (or runs) the deletion of a member's account.</summary>
    [HttpPost("members/{memberId}/deletion")]
    public async Task<ActionResult<ApiResponse<object>>> DeleteMember(ulong memberId, [FromBody] StaffDeletionBody body)
    {
        var result = await service.RequestForMemberAsync(memberId, body);
        return Ok(ApiResponse<object>.Ok(result, body.ProcessNow ? "Member's account deleted." : $"Scheduled for deletion on {result.ScheduledFor:dd MMM yyyy}."));
    }

    [HttpGet("settings")]
    public async Task<ActionResult<ApiResponse<object>>> Settings()
        => Ok(ApiResponse<object>.Ok(await service.GetSettingsAsync()));

    [HttpPut("settings")]
    public async Task<ActionResult<ApiResponse<object>>> SaveSettings([FromBody] PrivacySettings body)
        => Ok(ApiResponse<object>.Ok(await service.SaveSettingsAsync(body), "Privacy settings saved."));
}
