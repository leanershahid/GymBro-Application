using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Scheduling;
using GymManagmentApplication.Domain.Constants;
using GymManagmentApplication.Filters;
using Microsoft.AspNetCore.Mvc;

namespace GymManagmentApplication.Controllers;

/// <summary>Group classes: types, schedule, booking/waitlist, roster.</summary>
[ApiController]
[PermissionModule("classes")]
[Route("api/classes")]
[RequireModule("classes")]
public class ClassesController(ClassService service) : ControllerBase
{
    [HttpGet("types")]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer, RoleNames.Client)]
    public async Task<ActionResult<ApiResponse<object>>> Types([FromQuery] bool includeInactive = false)
        => Ok(ApiResponse<object>.Ok(await service.GetTypesAsync(includeInactive)));

    [HttpPost("types")]
    [AuthorizeRoles(RoleNames.Admin)]
    public async Task<ActionResult<ApiResponse<object>>> CreateType([FromBody] ClassTypeRequest request)
        => Ok(ApiResponse<object>.Ok(await service.SaveTypeAsync(null, request), "Class type created."));

    [HttpPut("types/{id:long}")]
    [AuthorizeRoles(RoleNames.Admin)]
    public async Task<ActionResult<ApiResponse<object>>> UpdateType(ulong id, [FromBody] ClassTypeRequest request)
        => Ok(ApiResponse<object>.Ok(await service.SaveTypeAsync(id, request), "Class type saved."));

    /// <summary>Schedule between from and to (UTC; default the next 7 days, max 62).</summary>
    [HttpGet]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer, RoleNames.Client)]
    public async Task<ActionResult<ApiResponse<object>>> Schedule([FromQuery] DateTime? from, [FromQuery] DateTime? to,
        [FromQuery] ulong? branchId, [FromQuery] ulong? trainerId)
    {
        var start = from ?? DateTime.UtcNow.Date;
        return Ok(ApiResponse<object>.Ok(await service.GetScheduleAsync(start, to ?? start.AddDays(7), branchId, trainerId)));
    }

    [HttpPost]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer)]
    public async Task<ActionResult<ApiResponse<object>>> Create([FromBody] CreateClassRequest request)
    {
        var created = await service.CreateAsync(request);
        return Ok(ApiResponse<object>.Ok(created, created.Count > 1 ? $"{created.Count} classes scheduled." : "Class scheduled."));
    }

    [HttpPut("{id:long}")]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer)]
    public async Task<ActionResult<ApiResponse<object>>> Update(ulong id, [FromBody] UpdateClassRequest request)
        => Ok(ApiResponse<object>.Ok(await service.UpdateAsync(id, request), "Class updated."));

    [HttpPost("{id:long}/cancel")]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer)]
    public async Task<ActionResult<ApiResponse<object>>> Cancel(ulong id, [FromBody] CancelClassRequest request)
    {
        var n = await service.CancelAsync(id, request);
        return Ok(ApiResponse<object>.Ok(new { cancelled = n }, n > 1 ? $"{n} classes cancelled." : "Class cancelled."));
    }

    [HttpPost("{id:long}/book")]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer, RoleNames.Client)]
    public async Task<ActionResult<ApiResponse<object>>> Book(ulong id, [FromBody] BookClassRequest request)
    {
        var result = await service.BookAsync(id, request);
        return Ok(ApiResponse<object>.Ok(result, result.MyBooking == "Waitlisted" ? "Class is full — added to the waitlist." : "Booked."));
    }

    [HttpDelete("{id:long}/book")]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer, RoleNames.Client)]
    public async Task<ActionResult<ApiResponse<object>>> CancelBooking(ulong id, [FromQuery] ulong? clientId)
        => Ok(ApiResponse<object>.Ok(await service.CancelBookingAsync(id, clientId), "Booking cancelled."));

    [HttpGet("me")]
    [AuthorizeRoles(RoleNames.Client)]
    public async Task<ActionResult<ApiResponse<object>>> MyBookings()
        => Ok(ApiResponse<object>.Ok(await service.GetMyBookingsAsync()));

    [HttpGet("{id:long}/roster")]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer)]
    public async Task<ActionResult<ApiResponse<object>>> Roster(ulong id)
        => Ok(ApiResponse<object>.Ok(await service.GetRosterAsync(id)));

    [HttpPut("{id:long}/attendance")]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer)]
    public async Task<ActionResult<ApiResponse<object>>> Attendance(ulong id, [FromBody] MarkAttendanceRequest request)
    {
        await service.MarkAttendanceAsync(id, request);
        return Ok(ApiResponse<object>.Ok((object)null!, "Attendance saved."));
    }
}
