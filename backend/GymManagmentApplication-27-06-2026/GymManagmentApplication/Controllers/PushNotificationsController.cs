using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Engagement;
using GymManagmentApplication.Application.Scheduling;
using GymManagmentApplication.Domain.Constants;
using GymManagmentApplication.Filters;
using Microsoft.AspNetCore.Mvc;

namespace GymManagmentApplication.Controllers;

/// <summary>Push devices and notification preferences of the signed-in user.</summary>
[ApiController]
[Route("api/me")]
[AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer, RoleNames.Client)]
public class PushNotificationsController(PushDeviceService devices, NotificationPreferenceService preferences) : ControllerBase
{
    /// <summary>Registers (or re-activates / moves to this account) the phone's Expo push token.</summary>
    [HttpPost("push-devices")]
    public async Task<ActionResult<ApiResponse<object>>> Register([FromBody] RegisterPushDeviceRequest request)
    {
        await devices.RegisterAsync(request);
        return Ok(ApiResponse<object>.Ok(new { registered = true }, "Push notifications are on for this device."));
    }

    /// <summary>Sign-out: this device stops receiving the caller's pushes.</summary>
    [HttpPost("push-devices/unregister")]
    public async Task<ActionResult<ApiResponse<object>>> Unregister([FromBody] UnregisterPushDeviceRequest request)
    {
        await devices.UnregisterAsync(request.Token);
        return Ok(ApiResponse<object>.Ok(new { unregistered = true }));
    }

    [HttpGet("notification-preferences")]
    public async Task<ActionResult<ApiResponse<NotificationPreferencesResponse>>> GetPreferences()
        => Ok(ApiResponse<NotificationPreferencesResponse>.Ok(await preferences.GetMineAsync()));

    [HttpPut("notification-preferences")]
    public async Task<ActionResult<ApiResponse<NotificationPreferencesResponse>>> UpdatePreferences([FromBody] UpdateNotificationPreferencesRequest request)
        => Ok(ApiResponse<NotificationPreferencesResponse>.Ok(
            await preferences.UpdateMineAsync(request, HttpContext.Connection.RemoteIpAddress?.ToString()), "Notification settings saved."));
}

/// <summary>Gym-wide notification settings: waitlist mode (auto-promote / offer), claim window, reminders.</summary>
[ApiController]
[Route("api/notification-settings")]
[AuthorizeRoles(RoleNames.Admin)]
public class NotificationSettingsController(IAppDbContext db, ICurrentUser currentUser) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<GymNotificationSettings>>> Get()
        => Ok(ApiResponse<GymNotificationSettings>.Ok(await WaitlistOfferService.LoadSettingsAsync(db, currentUser.ResolveTenantId())));

    [HttpPut]
    public async Task<ActionResult<ApiResponse<GymNotificationSettings>>> Put([FromBody] GymNotificationSettings request)
        => Ok(ApiResponse<GymNotificationSettings>.Ok(
            await WaitlistOfferService.SaveSettingsAsync(db, currentUser.ResolveTenantId(), request), "Notification settings saved."));
}

/// <summary>Members answer a waitlist offer ("offer" waitlist mode).</summary>
[ApiController]
[PermissionModule("classes")]
[Route("api/classes/{id:long}/waitlist-offer")]
[RequireModule("classes")]
[AuthorizeRoles(RoleNames.Client)]
public class WaitlistOffersController(ClassService classes) : ControllerBase
{
    [HttpPost("claim")]
    public async Task<ActionResult<ApiResponse<object>>> Claim(ulong id)
    {
        var (cls, claimed) = await classes.ClaimOfferAsync(id);
        if (!claimed) throw RuleException.Conflict("Sorry, this offer has expired and the spot went to the next person.");
        return Ok(ApiResponse<object>.Ok(cls, "You're in! Spot claimed."));
    }

    [HttpPost("decline")]
    public async Task<ActionResult<ApiResponse<object>>> Decline(ulong id)
        => Ok(ApiResponse<object>.Ok(await classes.DeclineOfferAsync(id), "No problem — we've offered the spot to the next person."));
}
