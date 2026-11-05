using System.Security.Claims;
using GymManagmentApplication.Application.Access;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Domain.Constants;
using GymManagmentApplication.Filters;
using Microsoft.AspNetCore.Mvc;

namespace GymManagmentApplication.Controllers;

/// <summary>
/// The module master: what the signed-in user may see (every app builds its menus from
/// <c>me</c>), and the admin endpoints that grant modules to roles and people. The management
/// endpoints are deliberately not module-gated, so an admin can't lock themselves out.
/// <para>
/// This is the authoritative access API (ARCH-050): module grants per role
/// (<c>roles/{roleId}/grants</c>), per-user overrides and additional roles
/// (<c>users/{id}/extra-roles</c>). The older RolesController endpoints —
/// <c>POST api/users/{id}/roles</c> (changes the MAIN role) and <c>api/roles/{id}/permissions</c> /
/// <c>api/permissions/matrix</c> (legacy "module.action" RolePermissions) — remain for compatibility
/// and are deprecated for new clients.
/// </para>
/// </summary>
[ApiController]
[Route("api/access")]
public class AccessController(IAccessService service) : ControllerBase
{
    private ulong CurrentUserId => ulong.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "0");

    // ── The signed-in user ────────────────────────────────────────────────

    /// <summary>Granted menu modules for the caller's app (no tabs), parents included, sorted.</summary>
    [HttpGet("me")]
    [AuthorizeRoles]
    public async Task<ActionResult<ApiResponse<object>>> GetMine([FromQuery] string? lang)
        => Ok(ApiResponse<object>.Ok(await service.GetMyModulesAsync(lang)));

    /// <summary>Granted page tabs — under <paramref name="parent"/>, or all when it is omitted.</summary>
    [HttpGet("me/tabs")]
    [AuthorizeRoles]
    public async Task<ActionResult<ApiResponse<object>>> GetMyTabs([FromQuery] string? parent, [FromQuery] string? lang)
        => Ok(ApiResponse<object>.Ok(await service.GetMyTabsAsync(parent, lang)));

    // ── Admin management ──────────────────────────────────────────────────

    /// <summary>The module tree — of one app ("admin", "trainer", "member"), or all.</summary>
    [HttpGet("modules")]
    [AuthorizeRoles(RoleNames.Admin)]
    public async Task<ActionResult<ApiResponse<object>>> GetModules([FromQuery] string? app)
        => Ok(ApiResponse<object>.Ok(await service.GetModuleTreeAsync(app)));

    /// <summary>Preset roles (front desk, coach, manager) the app offers when creating a role.</summary>
    [HttpGet("templates")]
    [AuthorizeRoles(RoleNames.Admin)]
    public ActionResult<ApiResponse<object>> GetTemplates()
        => Ok(ApiResponse<object>.Ok(RoleTemplates.All));

    /// <summary>People and module counts per role of this gym, for the role cards.</summary>
    [HttpGet("roles/summary")]
    [AuthorizeRoles(RoleNames.Admin)]
    public async Task<ActionResult<ApiResponse<object>>> GetRoleSummary()
        => Ok(ApiResponse<object>.Ok(await service.GetRoleSummaryAsync()));

    /// <summary>Everyone whose main role is admin, staff or a custom role — the "Staff" list on the access screen.</summary>
    [HttpGet("staff")]
    [AuthorizeRoles(RoleNames.Admin)]
    public async Task<ActionResult<ApiResponse<object>>> GetStaff()
        => Ok(ApiResponse<object>.Ok(await service.GetStaffAsync()));

    [HttpGet("roles/{roleId:long}/grants")]
    [AuthorizeRoles(RoleNames.Admin)]
    public async Task<ActionResult<ApiResponse<object>>> GetRoleGrants(ulong roleId)
        => Ok(ApiResponse<object>.Ok(await service.GetRoleGrantsAsync(roleId)));

    /// <summary>Replaces every grant of a role. Modules left out are removed.</summary>
    [HttpPut("roles/{roleId:long}/grants")]
    [AuthorizeRoles(RoleNames.Admin)]
    public async Task<ActionResult<ApiResponse<object>>> SetRoleGrants(ulong roleId, [FromBody] SetRoleGrantsRequest request)
        => Ok(ApiResponse<object>.Ok(await service.SetRoleGrantsAsync(roleId, request), "Role access updated."));

    [HttpGet("users/{id:long}")]
    [AuthorizeRoles(RoleNames.Admin)]
    public async Task<ActionResult<ApiResponse<object>>> GetUserAccess(ulong id)
        => Ok(ApiResponse<object>.Ok(await service.GetUserAccessAsync(id)));

    /// <summary>Replaces a user's overrides. Modules left out go back to what their roles grant.</summary>
    [HttpPut("users/{id:long}/overrides")]
    [AuthorizeRoles(RoleNames.Admin)]
    public async Task<ActionResult<ApiResponse<object>>> SetUserOverrides(ulong id, [FromBody] SetUserOverridesRequest request)
        => Ok(ApiResponse<object>.Ok(await service.SetUserOverridesAsync(id, CurrentUserId, request), "Access updated."));

    [HttpGet("users/{id:long}/extra-roles")]
    [AuthorizeRoles(RoleNames.Admin)]
    public async Task<ActionResult<ApiResponse<object>>> GetExtraRoles(ulong id)
        => Ok(ApiResponse<object>.Ok(await service.GetExtraRolesAsync(id)));

    [HttpPost("users/{id:long}/extra-roles")]
    [AuthorizeRoles(RoleNames.Admin)]
    public async Task<ActionResult<ApiResponse<object>>> AddExtraRole(ulong id, [FromBody] AddExtraRoleRequest request)
        => Ok(ApiResponse<object>.Ok(await service.AddExtraRoleAsync(id, request.RoleId), "Role added."));

    [HttpDelete("users/{id:long}/extra-roles/{roleId:long}")]
    [AuthorizeRoles(RoleNames.Admin)]
    public async Task<ActionResult<ApiResponse<object>>> RemoveExtraRole(ulong id, ulong roleId)
        => Ok(ApiResponse<object>.Ok(await service.RemoveExtraRoleAsync(id, roleId), "Role removed."));
}
