using FluentValidation;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Corporate.Interfaces;
using GymManagmentApplication.Application.Corporate.Requests;
using GymManagmentApplication.Filters;
using Microsoft.AspNetCore.Mvc;
using GymManagmentApplication.Domain.Constants;

namespace GymManagmentApplication.Controllers;

[ApiController]
[Route("api/corporate/accounts")]
[AuthorizeRoles(RoleNames.Admin)]
public class CorporateController(ICorporateService service, IValidator<CreateCorporateAccountRequest> validator) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<object>>> GetAll([FromQuery] CorporateAccountListRequest request)
        => Ok(ApiResponse<object>.Ok(await service.GetAllAsync(request)));

    [HttpPost]
    public async Task<ActionResult<ApiResponse<object>>> Create([FromBody] CreateCorporateAccountRequest request)
    {
        var v = await validator.ValidateAsync(request);
        if (!v.IsValid) return BadRequest(ApiResponse<object>.Fail("Validation failed.", v.Errors.Select(e => e.ErrorMessage).ToList()));
        var result = await service.CreateAsync(request);
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, ApiResponse<object>.Ok(result, "Corporate account created."));
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<object>>> GetById(ulong id)
    {
        var result = await service.GetByIdAsync(id);
        return result is null ? NotFound(ApiResponse<object>.Fail($"Corporate account {id} not found.")) : Ok(ApiResponse<object>.Ok(result));
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<ApiResponse<object>>> Update(ulong id, [FromBody] UpdateCorporateAccountRequest request)
    {
        var result = await service.UpdateAsync(id, request);
        return result is null ? NotFound(ApiResponse<object>.Fail($"Corporate account {id} not found.")) : Ok(ApiResponse<object>.Ok(result));
    }

    [HttpGet("{id}/members")]
    public async Task<ActionResult<ApiResponse<object>>> GetMembers(ulong id)
        => Ok(ApiResponse<object>.Ok(await service.GetMembersAsync(id)));

    [HttpPost("{id}/members")]
    public async Task<ActionResult<ApiResponse<object>>> AddMember(ulong id, [FromBody] AddCorporateMemberRequest request)
        => Ok(ApiResponse<object>.Ok(await service.AddMemberAsync(id, request)));

    [HttpDelete("{id}/members/{uid}")]
    public async Task<ActionResult<ApiResponse<object>>> RemoveMember(ulong id, ulong uid)
    {
        var removed = await service.RemoveMemberAsync(id, uid);
        return removed ? Ok(ApiResponse<object>.Ok((object)null!, "Member removed.")) : NotFound(ApiResponse<object>.Fail("Membership not found."));
    }

    [HttpGet("{id}/billing")]
    public async Task<ActionResult<ApiResponse<object>>> GetBilling(ulong id)
    {
        var result = await service.GetBillingAsync(id);
        return result is null ? NotFound(ApiResponse<object>.Fail($"Corporate account {id} not found.")) : Ok(ApiResponse<object>.Ok(result));
    }
}
