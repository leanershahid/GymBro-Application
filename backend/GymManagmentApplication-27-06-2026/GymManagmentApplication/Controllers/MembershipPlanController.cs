using GymManagmentApplication.Application.Billing.Interfaces;
using GymManagmentApplication.Application.Billing.Requests;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Filters;
using Microsoft.AspNetCore.Mvc;
using GymManagmentApplication.Domain.Constants;

namespace GymManagmentApplication.Controllers;

[ApiController]
[Route("api/membership-plans")]
[AuthorizeRoles(RoleNames.Admin)]
public class MembershipPlanController(IMembershipPlanService service) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<object>>> GetAll([FromQuery] ulong tenantId)
        => Ok(ApiResponse<object>.Ok(await service.GetAllAsync(tenantId)));

    [HttpPost]
    public async Task<ActionResult<ApiResponse<object>>> Create([FromBody] CreateMembershipPlanRequest request)
    {
        var result = await service.CreateAsync(request);
        return CreatedAtAction(nameof(GetById), new { id = result.Id },
            ApiResponse<object>.Ok(result, "Membership plan created."));
    }

    [HttpGet("{id:long}")]
    public async Task<ActionResult<ApiResponse<object>>> GetById(ulong id)
    {
        var result = await service.GetByIdAsync(id);
        return result is null ? NotFound(ApiResponse<object>.Fail($"Plan {id} not found."))
            : Ok(ApiResponse<object>.Ok(result));
    }

    [HttpPut("{id:long}")]
    public async Task<ActionResult<ApiResponse<object>>> Update(ulong id,
        [FromBody] UpdateMembershipPlanRequest request)
    {
        var result = await service.UpdateAsync(id, request);
        return result is null ? NotFound(ApiResponse<object>.Fail($"Plan {id} not found."))
            : Ok(ApiResponse<object>.Ok(result, "Plan updated."));
    }

    [HttpDelete("{id:long}")]
    public async Task<ActionResult<ApiResponse<object>>> Archive(ulong id)
    {
        var ok = await service.ArchiveAsync(id);
        return ok ? Ok(ApiResponse<object>.Ok((object)null!, "Plan archived."))
            : NotFound(ApiResponse<object>.Fail($"Plan {id} not found."));
    }

    [HttpGet("{id:long}/features")]
    public async Task<ActionResult<ApiResponse<object>>> GetFeatures(ulong id)
        => Ok(ApiResponse<object>.Ok(await service.GetFeaturesAsync(id)));

    [HttpPut("{id:long}/features")]
    public async Task<ActionResult<ApiResponse<object>>> UpdateFeatures(ulong id,
        [FromBody] UpdatePlanFeaturesRequest request)
    {
        var result = await service.UpdateFeaturesAsync(id, request);
        return result is null ? NotFound(ApiResponse<object>.Fail($"Plan {id} not found."))
            : Ok(ApiResponse<object>.Ok(result, "Features updated."));
    }
}
