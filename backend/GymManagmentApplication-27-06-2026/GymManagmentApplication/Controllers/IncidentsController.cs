using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Facilities;
using GymManagmentApplication.Application.Safety;
using GymManagmentApplication.Domain.Constants;
using GymManagmentApplication.Filters;
using Microsoft.AspNetCore.Mvc;

namespace GymManagmentApplication.Controllers;

/// <summary>
/// The staff incident log. Every endpoint needs the restricted <c>admin.incidents</c> module (API key
/// <c>incidents</c>; admins by default, grantable to other roles, not part of any role template).
/// Members and trainers get 403. Every call is audit-logged (AuditLog, EntityType "Incident").
/// </summary>
[ApiController]
[Route("api/incidents")]
[AuthorizeRoles(RoleNames.Admin)]
[PermissionModule(FacilitiesCommon.IncidentsApi)]
[RequireModule(FacilitiesCommon.IncidentsApi)]
public class IncidentsController(IncidentService service) : ControllerBase
{
    private RequestMeta Meta => new(HttpContext.Connection.RemoteIpAddress?.ToString(), Request.Headers.UserAgent.ToString());

    [HttpGet]
    public async Task<ActionResult<ApiResponse<IncidentPage>>> List([FromQuery] IncidentQuery query)
        => Ok(ApiResponse<IncidentPage>.Ok(await service.ListAsync(query, Meta)));

    [HttpGet("people")]
    public async Task<ActionResult<ApiResponse<List<PersonSearchItem>>>> People([FromQuery] string? q)
        => Ok(ApiResponse<List<PersonSearchItem>>.Ok(await service.SearchPeopleAsync(q)));

    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<IncidentDetail>>> Get(ulong id)
        => Ok(ApiResponse<IncidentDetail>.Ok(await service.GetAsync(id, Meta)));

    [HttpGet("{id}/audit")]
    public async Task<ActionResult<ApiResponse<List<IncidentAuditEntry>>>> Audit(ulong id)
        => Ok(ApiResponse<List<IncidentAuditEntry>>.Ok(await service.AuditTrailAsync(id, Meta)));

    [HttpPost]
    public async Task<ActionResult<ApiResponse<IncidentDetail>>> Create([FromBody] IncidentRequest request)
        => Ok(ApiResponse<IncidentDetail>.Ok(await service.CreateAsync(request, Meta), "Incident logged."));

    /// <summary>Open incidents only (409 INCIDENT_CLOSED otherwise).</summary>
    [HttpPut("{id}")]
    public async Task<ActionResult<ApiResponse<IncidentDetail>>> Update(ulong id, [FromBody] IncidentRequest request)
        => Ok(ApiResponse<IncidentDetail>.Ok(await service.UpdateAsync(id, request, Meta), "Incident saved."));

    /// <summary>Seals the record; afterwards only addenda.</summary>
    [HttpPost("{id}/close")]
    public async Task<ActionResult<ApiResponse<IncidentDetail>>> Close(ulong id, [FromBody] CloseIncidentRequest request)
        => Ok(ApiResponse<IncidentDetail>.Ok(await service.CloseAsync(id, request, Meta), "Incident closed."));

    [HttpPost("{id}/addenda")]
    public async Task<ActionResult<ApiResponse<IncidentDetail>>> Addendum(ulong id, [FromBody] AddendumRequest request)
        => Ok(ApiResponse<IncidentDetail>.Ok(await service.AddAddendumAsync(id, request, Meta), "Addendum added."));
}
