using FluentValidation;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.WorkoutAutomation.Interfaces;
using GymManagmentApplication.Application.WorkoutAutomation.Requests;
using GymManagmentApplication.Filters;
using Microsoft.AspNetCore.Mvc;
using GymManagmentApplication.Domain.Constants;

namespace GymManagmentApplication.Controllers;

[ApiController]
[Route("api/workout-automation")]
[AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer)]
public class WorkoutAutomationController(
    IWorkoutAutomationService service,
    IValidator<CreateAutomationRuleRequest> createValidator,
    IValidator<TriggerAutomationRequest> triggerValidator) : ControllerBase
{
    [HttpGet("rules")]
    public async Task<ActionResult<ApiResponse<object>>> GetRules([FromQuery] ulong tenantId)
        => Ok(ApiResponse<object>.Ok(await service.GetRulesAsync(tenantId)));

    [HttpPost("rules")]
    public async Task<ActionResult<ApiResponse<object>>> CreateRule([FromBody] CreateAutomationRuleRequest request)
    {
        var v = await createValidator.ValidateAsync(request);
        if (!v.IsValid) return BadRequest(ApiResponse<object>.Fail("Validation failed.", v.Errors.Select(e => e.ErrorMessage).ToList()));
        return Ok(ApiResponse<object>.Ok(await service.CreateRuleAsync(request), "Automation rule created."));
    }

    [HttpPut("rules/{id:long}")]
    public async Task<ActionResult<ApiResponse<object>>> UpdateRule(ulong id, [FromBody] UpdateAutomationRuleRequest request)
    {
        var result = await service.UpdateRuleAsync(id, request);
        return result is null ? NotFound(ApiResponse<object>.Fail("Rule not found.")) : Ok(ApiResponse<object>.Ok(result, "Rule updated."));
    }

    [HttpDelete("rules/{id:long}")]
    public async Task<ActionResult<ApiResponse<object>>> DeleteRule(ulong id)
    {
        var ok = await service.DeleteRuleAsync(id);
        return ok ? Ok(ApiResponse<object>.Ok((object)null!, "Rule deleted.")) : NotFound(ApiResponse<object>.Fail("Rule not found."));
    }

    [HttpPost("trigger")]
    public async Task<ActionResult<ApiResponse<object>>> Trigger([FromBody] TriggerAutomationRequest request)
    {
        var v = await triggerValidator.ValidateAsync(request);
        if (!v.IsValid) return BadRequest(ApiResponse<object>.Fail("Validation failed.", v.Errors.Select(e => e.ErrorMessage).ToList()));
        return Ok(ApiResponse<object>.Ok(await service.TriggerAsync(request)));
    }

    [HttpGet("logs")]
    public async Task<ActionResult<ApiResponse<object>>> GetLogs([FromQuery] AutomationLogListRequest request)
        => Ok(ApiResponse<object>.Ok(await service.GetLogsAsync(request)));
}
