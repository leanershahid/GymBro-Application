using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Scheduling;
using GymManagmentApplication.Domain.Constants;
using GymManagmentApplication.Filters;
using Microsoft.AspNetCore.Mvc;

namespace GymManagmentApplication.Controllers;

/// <summary>Personal training: session types and bookings.</summary>
[ApiController]
[PermissionModule("pt-sessions")]
[Route("api/pt")]
[RequireModule("pt-sessions")]
[AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer, RoleNames.Client)]
public class PtController(PtService service) : ControllerBase
{
    [HttpGet("types")]
    public async Task<ActionResult<ApiResponse<object>>> Types([FromQuery] ulong? trainerId)
        => Ok(ApiResponse<object>.Ok(await service.GetTypesAsync(trainerId)));

    [HttpPost("types")]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer)]
    public async Task<ActionResult<ApiResponse<object>>> CreateType([FromBody] PtTypeRequest request)
        => Ok(ApiResponse<object>.Ok(await service.SaveTypeAsync(null, request), "Session type created."));

    [HttpPut("types/{id:long}")]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer)]
    public async Task<ActionResult<ApiResponse<object>>> UpdateType(ulong id, [FromBody] PtTypeRequest request)
        => Ok(ApiResponse<object>.Ok(await service.SaveTypeAsync(id, request), "Session type saved."));

    /// <summary>Sessions visible to the caller (members: theirs; trainers: theirs; staff: all, filterable).</summary>
    [HttpGet("sessions")]
    public async Task<ActionResult<ApiResponse<object>>> Sessions([FromQuery] DateTime? from, [FromQuery] DateTime? to,
        [FromQuery] ulong? trainerId, [FromQuery] ulong? clientId)
        => Ok(ApiResponse<object>.Ok(await service.GetSessionsAsync(from, to, trainerId, clientId)));

    [HttpPost("sessions")]
    public async Task<ActionResult<ApiResponse<object>>> Book([FromBody] BookPtRequest request)
        => Ok(ApiResponse<object>.Ok(await service.BookAsync(request), "Session booked."));

    [HttpPut("sessions/{id:long}/status")]
    public async Task<ActionResult<ApiResponse<object>>> Status(ulong id, [FromBody] UpdatePtStatusRequest request)
        => Ok(ApiResponse<object>.Ok(await service.UpdateStatusAsync(id, request), "Session updated."));

    [HttpPost("sessions/{id:long}/rate")]
    [AuthorizeRoles(RoleNames.Client)]
    public async Task<ActionResult<ApiResponse<object>>> Rate(ulong id, [FromBody] RatePtRequest request)
        => Ok(ApiResponse<object>.Ok(await service.RateAsync(id, request), "Thanks for rating!"));
}
