using System.Security.Claims;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Health.Interfaces;
using GymManagmentApplication.Filters;
using Microsoft.AspNetCore.Mvc;
using GymManagmentApplication.Domain.Constants;

namespace GymManagmentApplication.Controllers;

[ApiController]
[Route("api/health")]
[RequireModule("stats")]
public class HealthController(IHealthService service) : ControllerBase
{
    private ulong UserId => ulong.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "0");

    [HttpGet("today")]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer, RoleNames.Client)]
    public async Task<ActionResult<ApiResponse<object>>> GetToday()
        => Ok(ApiResponse<object>.Ok(await service.GetTodayAsync(UserId)));

    [HttpGet("admin/overview")]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer)]
    public async Task<ActionResult<ApiResponse<object>>> GetAdminOverview()
        => Ok(ApiResponse<object>.Ok(await service.GetAdminOverviewAsync()));
}
