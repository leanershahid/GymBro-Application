using FluentValidation;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Trainer.Interfaces;
using GymManagmentApplication.Application.Trainer.Requests;
using GymManagmentApplication.Filters;
using Microsoft.AspNetCore.Mvc;
using GymManagmentApplication.Domain.Constants;

namespace GymManagmentApplication.Controllers;

[ApiController]
[Route("api/trainers")]
[AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer, RoleNames.Client)]
public class TrainerController(ITrainerService service, IValidator<CreateTrainerRequest> validator) : ControllerBase
{
    [HttpGet]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer, RoleNames.Client)]
    public async Task<ActionResult<ApiResponse<object>>> GetAll([FromQuery] int pageNumber = 1, [FromQuery] int pageSize = 20)
        => Ok(ApiResponse<object>.Ok(await service.GetAllAsync(pageNumber, pageSize)));

    [HttpPost]
    [AuthorizeRoles(RoleNames.Admin)]
    public async Task<ActionResult<ApiResponse<object>>> Create([FromBody] CreateTrainerRequest request)
    {
        var v = await validator.ValidateAsync(request);
        if (!v.IsValid) return BadRequest(ApiResponse<object>.Fail("Validation failed.", v.Errors.Select(e => e.ErrorMessage).ToList()));
        var result = await service.CreateAsync(request);
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, ApiResponse<object>.Ok(result, "Trainer created successfully."));
    }

    [HttpGet("{id}")]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer, RoleNames.Client)]
    public async Task<ActionResult<ApiResponse<object>>> GetById(ulong id)
    {
        var result = await service.GetByIdAsync(id);
        return result is null ? NotFound(ApiResponse<object>.Fail($"Trainer {id} not found.")) : Ok(ApiResponse<object>.Ok(result));
    }

    [HttpPut("{id}")]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer)]
    public async Task<ActionResult<ApiResponse<object>>> Update(ulong id, [FromBody] UpdateTrainerRequest request)
    {
        var result = await service.UpdateAsync(id, request);
        return result is null ? NotFound(ApiResponse<object>.Fail($"Trainer {id} not found.")) : Ok(ApiResponse<object>.Ok(result));
    }

    [HttpGet("{id}/clients")]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer)]
    public async Task<ActionResult<ApiResponse<object>>> GetClients(ulong id)
        => Ok(ApiResponse<object>.Ok(await service.GetClientsAsync(id)));

    [HttpPost("{id}/assign")]
    [AuthorizeRoles(RoleNames.Admin)]
    public async Task<ActionResult<ApiResponse<object>>> AssignClient(ulong id, [FromBody] AssignClientRequest request)
        => Ok(ApiResponse<object>.Ok(await service.AssignClientAsync(id, request)));

    [HttpDelete("{id}/clients/{cid}")]
    [AuthorizeRoles(RoleNames.Admin)]
    public async Task<ActionResult<ApiResponse<object>>> UnassignClient(ulong id, ulong cid)
    {
        var removed = await service.UnassignClientAsync(id, cid);
        return removed ? Ok(ApiResponse<object>.Ok((object)null!, "Client unassigned.")) : NotFound(ApiResponse<object>.Fail("Assignment not found."));
    }

    [HttpGet("{id}/schedule")]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer, RoleNames.Client)]
    public async Task<ActionResult<ApiResponse<object>>> GetSchedule(ulong id)
        => Ok(ApiResponse<object>.Ok(await service.GetScheduleAsync(id)));

    [HttpPut("{id}/schedule")]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer)]
    public async Task<ActionResult<ApiResponse<object>>> SetSchedule(ulong id, [FromBody] SetScheduleRequest request)
        => Ok(ApiResponse<object>.Ok(await service.SetScheduleAsync(id, request)));

    [HttpGet("{id}/performance")]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer)]
    public async Task<ActionResult<ApiResponse<object>>> GetPerformance(ulong id)
        => Ok(ApiResponse<object>.Ok(await service.GetPerformanceAsync(id)));

    [HttpGet("{id}/earnings")]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer)]
    public async Task<ActionResult<ApiResponse<object>>> GetEarnings(ulong id, [FromQuery] int month = 0, [FromQuery] int year = 0)
        => Ok(ApiResponse<object>.Ok(await service.GetEarningsAsync(id, month == 0 ? DateTime.UtcNow.Month : month, year == 0 ? DateTime.UtcNow.Year : year)));

    [HttpPost("auto-assign")]
    [AuthorizeRoles(RoleNames.Admin)]
    public async Task<ActionResult<ApiResponse<object>>> AutoAssign([FromQuery] ulong clientId, [FromQuery] ulong branchId)
    {
        var result = await service.AutoAssignAsync(clientId, branchId);
        return result is null ? NotFound(ApiResponse<object>.Fail("No available trainers found.")) : Ok(ApiResponse<object>.Ok(result));
    }
}
