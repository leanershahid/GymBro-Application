using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Engagement;
using GymManagmentApplication.Domain.Constants;
using GymManagmentApplication.Filters;
using Microsoft.AspNetCore.Mvc;

namespace GymManagmentApplication.Controllers;

/// <summary>In-app notifications for the signed-in user.</summary>
[ApiController]
[Route("api/notifications")]
[AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer, RoleNames.Client)]
public class NotificationsController(Notifier notifier) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<object>>> Mine([FromQuery] bool unreadOnly = false)
        => Ok(ApiResponse<object>.Ok(new { items = await notifier.GetMineAsync(unreadOnly), unread = await notifier.UnreadCountAsync() }));

    [HttpPut("{id:long}/read")]
    public async Task<ActionResult<ApiResponse<object>>> Read(ulong id)
        => Ok(ApiResponse<object>.Ok(new { updated = await notifier.MarkReadAsync(id) }));

    [HttpPut("read-all")]
    public async Task<ActionResult<ApiResponse<object>>> ReadAll()
        => Ok(ApiResponse<object>.Ok(new { updated = await notifier.MarkReadAsync(null) }));
}
