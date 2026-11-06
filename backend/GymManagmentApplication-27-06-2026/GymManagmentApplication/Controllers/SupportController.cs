using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Support;
using GymManagmentApplication.Domain.Constants;
using GymManagmentApplication.Filters;
using Microsoft.AspNetCore.Mvc;

namespace GymManagmentApplication.Controllers;

/// <summary>
/// Help &amp; feedback for members (roadmap feature 6): FAQ, my requests and their thread, rate and
/// reopen, plus post-class feedback. Always the signed-in member's own data, no module needed.
/// Internal staff notes are never returned here.
/// </summary>
[ApiController]
[Route("api/me")]
[AuthorizeRoles(RoleNames.Client)]
public class MySupportController(SupportService support, ClassFeedbackService feedback) : ControllerBase
{
    /// <summary>FAQ (search with ?search=), categories and my open counts.</summary>
    [HttpGet("help")]
    public async Task<ActionResult<ApiResponse<object>>> Help([FromQuery] string? search)
        => Ok(ApiResponse<object>.Ok(await support.HelpCentreAsync(search)));

    [HttpGet("support-requests")]
    public async Task<ActionResult<ApiResponse<object>>> Mine()
        => Ok(ApiResponse<object>.Ok(await support.MineAsync()));

    [HttpGet("support-requests/{id}")]
    public async Task<ActionResult<ApiResponse<object>>> One(ulong id)
        => Ok(ApiResponse<object>.Ok(await support.MineAsync(id)));

    [HttpPost("support-requests")]
    public async Task<ActionResult<ApiResponse<object>>> Create([FromBody] CreateSupportRequestBody body)
        => Ok(ApiResponse<object>.Ok(await support.CreateAsync(body), "Thanks — we've got your request."));

    [HttpPost("support-requests/{id}/messages")]
    public async Task<ActionResult<ApiResponse<object>>> Reply(ulong id, [FromBody] SupportReplyBody body)
        => Ok(ApiResponse<object>.Ok(await support.MemberReplyAsync(id, body), "Sent."));

    [HttpPost("support-requests/{id}/rate")]
    public async Task<ActionResult<ApiResponse<object>>> Rate(ulong id, [FromBody] RateSupportBody body)
        => Ok(ApiResponse<object>.Ok(await support.RateAsync(id, body), "Thanks for the feedback!"));

    [HttpPost("support-requests/{id}/reopen")]
    public async Task<ActionResult<ApiResponse<object>>> Reopen(ulong id, [FromBody] ReopenSupportBody? body)
        => Ok(ApiResponse<object>.Ok(await support.ReopenAsync(id, body), "Reopened."));

    [HttpPost("support-requests/{id}/resolve")]
    public async Task<ActionResult<ApiResponse<object>>> Resolve(ulong id)
        => Ok(ApiResponse<object>.Ok(await support.MemberResolveAsync(id), "Glad it's sorted."));

    /// <summary>The attended class Home should ask about, or null.</summary>
    [HttpGet("class-feedback/pending")]
    public async Task<ActionResult<ApiResponse<object?>>> PendingFeedback()
        => Ok(ApiResponse<object?>.Ok(await feedback.PendingAsync()));

    [HttpPost("class-feedback")]
    public async Task<ActionResult<ApiResponse<object?>>> SubmitFeedback([FromBody] ClassFeedbackBody body)
    {
        await feedback.SubmitAsync(body);
        return Ok(ApiResponse<object?>.Ok(null, body.Skip ? "No problem." : "Thanks for the feedback!"));
    }
}

/// <summary>Staff support queue (module <c>admin.support</c>, API key <c>support</c>): requests, FAQ, canned replies, settings, class feedback.</summary>
[ApiController]
[Route("api/support")]
[AuthorizeRoles(RoleNames.Admin)]
[PermissionModule(SupportCommon.ApiKey)]
[RequireModule(SupportCommon.ApiKey)]
public class SupportController(SupportService support, SupportContentService content, ClassFeedbackService feedback) : ControllerBase
{
    /// <summary>status: active (default) | open | waiting | resolved | closed | all; assignee: me | none | id; overdue=true.</summary>
    [HttpGet("requests")]
    public async Task<ActionResult<ApiResponse<object>>> Queue([FromQuery] SupportQueueFilter filter)
        => Ok(ApiResponse<object>.Ok(await support.QueueAsync(filter)));

    /// <summary>Badge: unassigned + overdue.</summary>
    [HttpGet("requests/count")]
    public async Task<ActionResult<ApiResponse<object>>> Count()
        => Ok(ApiResponse<object>.Ok(await support.CountAsync()));

    [HttpGet("requests/{id}")]
    public async Task<ActionResult<ApiResponse<object>>> Get(ulong id)
        => Ok(ApiResponse<object>.Ok(await support.GetAsync(id)));

    /// <summary>A reply (internal=false; status after it, default waiting) or an internal note (internal=true).</summary>
    [HttpPost("requests/{id}/messages")]
    public async Task<ActionResult<ApiResponse<object>>> Reply(ulong id, [FromBody] SupportReplyBody body)
        => Ok(ApiResponse<object>.Ok(await support.StaffReplyAsync(id, body), body.Internal ? "Note added." : "Reply sent."));

    [HttpPut("requests/{id}/assign")]
    public async Task<ActionResult<ApiResponse<object>>> Assign(ulong id, [FromBody] AssignSupportBody body)
        => Ok(ApiResponse<object>.Ok(await support.AssignAsync(id, body), body.AssigneeId is null ? "Unassigned." : "Assigned."));

    [HttpPut("requests/{id}/priority")]
    public async Task<ActionResult<ApiResponse<object>>> Priority(ulong id, [FromBody] SupportPriorityBody body)
        => Ok(ApiResponse<object>.Ok(await support.SetPriorityAsync(id, body), "Priority updated."));

    [HttpPut("requests/{id}/status")]
    public async Task<ActionResult<ApiResponse<object>>> Status(ulong id, [FromBody] SupportStatusBody body)
        => Ok(ApiResponse<object>.Ok(await support.SetStatusAsync(id, body), "Status updated."));

    /// <summary>People a request can be assigned to.</summary>
    [HttpGet("staff")]
    public async Task<ActionResult<ApiResponse<object>>> Staff()
        => Ok(ApiResponse<object>.Ok(await support.StaffOptionsAsync()));

    [HttpGet("faqs")]
    public async Task<ActionResult<ApiResponse<object>>> Faqs()
        => Ok(ApiResponse<object>.Ok(await content.FaqsAsync()));

    [HttpPost("faqs")]
    public async Task<ActionResult<ApiResponse<object>>> CreateFaq([FromBody] SupportFaqBody body)
        => Ok(ApiResponse<object>.Ok(await content.CreateFaqAsync(body), "Question added."));

    [HttpPut("faqs/{id}")]
    public async Task<ActionResult<ApiResponse<object>>> UpdateFaq(ulong id, [FromBody] SupportFaqBody body)
        => Ok(ApiResponse<object>.Ok(await content.UpdateFaqAsync(id, body), "Question saved."));

    [HttpDelete("faqs/{id}")]
    public async Task<ActionResult<ApiResponse<object?>>> DeleteFaq(ulong id)
    {
        await content.DeleteFaqAsync(id);
        return Ok(ApiResponse<object?>.Ok(null, "Question removed."));
    }

    [HttpGet("canned-replies")]
    public async Task<ActionResult<ApiResponse<object>>> Canned()
        => Ok(ApiResponse<object>.Ok(await content.CannedAsync()));

    [HttpPost("canned-replies")]
    public async Task<ActionResult<ApiResponse<object>>> CreateCanned([FromBody] SupportCannedReplyBody body)
        => Ok(ApiResponse<object>.Ok(await content.CreateCannedAsync(body), "Saved reply added."));

    [HttpPut("canned-replies/{id}")]
    public async Task<ActionResult<ApiResponse<object>>> UpdateCanned(ulong id, [FromBody] SupportCannedReplyBody body)
        => Ok(ApiResponse<object>.Ok(await content.UpdateCannedAsync(id, body), "Saved reply updated."));

    [HttpDelete("canned-replies/{id}")]
    public async Task<ActionResult<ApiResponse<object?>>> DeleteCanned(ulong id)
    {
        await content.DeleteCannedAsync(id);
        return Ok(ApiResponse<object?>.Ok(null, "Saved reply removed."));
    }

    /// <summary>SLA targets, class feedback on/off (TenantSettings "support").</summary>
    [HttpGet("settings")]
    public async Task<ActionResult<ApiResponse<object>>> Settings()
        => Ok(ApiResponse<object>.Ok(await content.SettingsAsync()));

    [HttpPut("settings")]
    public async Task<ActionResult<ApiResponse<object>>> SaveSettings([FromBody] SupportSettings body)
        => Ok(ApiResponse<object>.Ok(await content.SaveSettingsAsync(body), "Settings saved."));

    /// <summary>Class feedback averages per class type / trainer + recent comments + support satisfaction.</summary>
    [HttpGet("feedback")]
    public async Task<ActionResult<ApiResponse<object>>> Feedback([FromQuery] int days = 90)
        => Ok(ApiResponse<object>.Ok(await feedback.SummaryAsync(days)));
}

/// <summary>Trainers: only the help requests assigned to them (reply, note, change status).</summary>
[ApiController]
[Route("api/trainer/support")]
[AuthorizeRoles(RoleNames.Trainer)]
public class TrainerSupportController(SupportService support, SupportContentService content) : ControllerBase
{
    [HttpGet("requests")]
    public async Task<ActionResult<ApiResponse<object>>> Queue([FromQuery] SupportQueueFilter filter)
        => Ok(ApiResponse<object>.Ok(await support.QueueAsync(filter, assignedOnly: true)));

    [HttpGet("requests/count")]
    public async Task<ActionResult<ApiResponse<object>>> Count()
        => Ok(ApiResponse<object>.Ok(await support.CountAsync(assignedOnly: true)));

    [HttpGet("requests/{id}")]
    public async Task<ActionResult<ApiResponse<object>>> Get(ulong id)
        => Ok(ApiResponse<object>.Ok(await support.GetAsync(id, assignedOnly: true)));

    [HttpPost("requests/{id}/messages")]
    public async Task<ActionResult<ApiResponse<object>>> Reply(ulong id, [FromBody] SupportReplyBody body)
        => Ok(ApiResponse<object>.Ok(await support.StaffReplyAsync(id, body, assignedOnly: true), body.Internal ? "Note added." : "Reply sent."));

    [HttpPut("requests/{id}/status")]
    public async Task<ActionResult<ApiResponse<object>>> Status(ulong id, [FromBody] SupportStatusBody body)
        => Ok(ApiResponse<object>.Ok(await support.SetStatusAsync(id, body, assignedOnly: true), "Status updated."));

    [HttpGet("canned-replies")]
    public async Task<ActionResult<ApiResponse<object>>> Canned()
        => Ok(ApiResponse<object>.Ok(await content.CannedAsync()));
}
