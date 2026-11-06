using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Messaging;
using GymManagmentApplication.Application.Safety;
using GymManagmentApplication.Domain.Constants;
using GymManagmentApplication.Filters;
using Microsoft.AspNetCore.Mvc;

namespace GymManagmentApplication.Controllers;

/// <summary>
/// Trainer ↔ member messaging (roadmap feature 8) for both participants: a trainer (role trainer)
/// or a member (role client) always acts on their own threads only; no module needed. Delivery is by
/// polling (the app refetches the open thread every 10 s and the inbox every 60 s).
/// </summary>
[ApiController]
[Route("api/messages")]
[AuthorizeRoles(RoleNames.Client, RoleNames.Trainer)]
public class MessagesController(MessagingService messages) : ControllerBase
{
    /// <summary>My inbox: threads with messages, newest first, with unread counts.</summary>
    [HttpGet("conversations")]
    public async Task<ActionResult<ApiResponse<object>>> List()
        => Ok(ApiResponse<object>.Ok(await messages.ListAsync()));

    /// <summary>Badge: unread messages in total and the number of threads with any.</summary>
    [HttpGet("unread")]
    public async Task<ActionResult<ApiResponse<object>>> Unread()
        => Ok(ApiResponse<object>.Ok(await messages.UnreadAsync()));

    /// <summary>Who I can message now (member: my trainers; trainer: my clients), with any existing thread id.</summary>
    [HttpGet("contacts")]
    public async Task<ActionResult<ApiResponse<object>>> Contacts()
        => Ok(ApiResponse<object>.Ok(await messages.ContactsAsync()));

    /// <summary>Opens (or creates, when allowed) the thread with a trainer / client.</summary>
    [HttpPost("conversations")]
    public async Task<ActionResult<ApiResponse<object>>> Open([FromBody] OpenConversationBody body)
        => Ok(ApiResponse<object>.Ok(await messages.OpenAsync(body)));

    /// <summary>The thread (newest 50; older with ?before={messageId}); marks it read.</summary>
    [HttpGet("conversations/{id}")]
    public async Task<ActionResult<ApiResponse<object>>> Thread(ulong id, [FromQuery] ulong? before)
        => Ok(ApiResponse<object>.Ok(await messages.ThreadAsync(id, before)));

    /// <summary>Send. Idempotent per clientMessageId; 30 per minute per user (429 MESSAGE_RATE_LIMITED); 422 MESSAGING_* when read-only.</summary>
    [HttpPost("conversations/{id}/messages")]
    public async Task<ActionResult<ApiResponse<object>>> Send(ulong id, [FromBody] SendMessageBody body)
        => Ok(ApiResponse<object>.Ok(await messages.SendAsync(id, body)));

    [HttpPost("conversations/{id}/read")]
    public async Task<ActionResult<ApiResponse<object?>>> Read(ulong id)
    {
        await messages.MarkReadAsync(id);
        return Ok(ApiResponse<object?>.Ok(null));
    }

    [HttpPut("conversations/{id}/mute")]
    public async Task<ActionResult<ApiResponse<object>>> Mute(ulong id, [FromBody] MuteBody body)
        => Ok(ApiResponse<object>.Ok(new { muted = await messages.MuteAsync(id, body.Muted) }, body.Muted ? "Muted." : "Notifications on."));

    /// <summary>Trainers: workouts / plans they assigned to this member, to link in a message.</summary>
    [HttpGet("conversations/{id}/attachables")]
    public async Task<ActionResult<ApiResponse<object>>> Attachables(ulong id)
        => Ok(ApiResponse<object>.Ok(await messages.AttachablesAsync(id)));

    /// <summary>Report a message I received: the gym's staff get a "Staff &amp; trainers" help request.</summary>
    [HttpPost("{messageId}/report")]
    public async Task<ActionResult<ApiResponse<object>>> Report(ulong messageId, [FromBody] ReportMessageBody body)
        => Ok(ApiResponse<object>.Ok(await messages.ReportAsync(messageId, body), "Thanks — the gym will look into it."));

    /// <summary>Members: "Allow my trainer to message me".</summary>
    [HttpGet("settings")]
    public async Task<ActionResult<ApiResponse<object>>> Settings()
        => Ok(ApiResponse<object>.Ok(await messages.MySettingsAsync()));

    [HttpPut("settings")]
    public async Task<ActionResult<ApiResponse<object>>> SaveSettings([FromBody] MyMessagingSettings body)
        => Ok(ApiResponse<object>.Ok(await messages.SaveMySettingsAsync(body), "Saved."));
}

/// <summary>
/// Safeguarding review (module <c>admin.messages</c>, API key <c>messages-review</c>): read-only
/// threads, every view audit-logged, plus the gym's messaging policy (TenantSettings "messaging").
/// </summary>
[ApiController]
[Route("api/messages-review")]
[AuthorizeRoles(RoleNames.Admin)]
[PermissionModule(MessagingReviewService.ApiKey)]
[RequireModule(MessagingReviewService.ApiKey)]
public class MessagesReviewController(MessagingReviewService review) : ControllerBase
{
    private RequestMeta Meta => new(HttpContext.Connection.RemoteIpAddress?.ToString(), Request.Headers.UserAgent.ToString());

    /// <summary>search = trainer or member name / email; reported=true = only threads with a reported message.</summary>
    [HttpGet("conversations")]
    public async Task<ActionResult<ApiResponse<object>>> List([FromQuery] string? search, [FromQuery] bool reported = false)
        => Ok(ApiResponse<object>.Ok(await review.ListAsync(search, reported, Meta)));

    [HttpGet("conversations/{id}")]
    public async Task<ActionResult<ApiResponse<object>>> Thread(ulong id)
        => Ok(ApiResponse<object>.Ok(await review.ThreadAsync(id, Meta)));

    [HttpGet("settings")]
    public async Task<ActionResult<ApiResponse<object>>> Settings()
        => Ok(ApiResponse<object>.Ok(await review.SettingsAsync()));

    [HttpPut("settings")]
    public async Task<ActionResult<ApiResponse<object>>> SaveSettings([FromBody] MessagingSettings body)
        => Ok(ApiResponse<object>.Ok(await review.SaveSettingsAsync(body), "Saved."));
}
