using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Dashboard.Interfaces;
using GymManagmentApplication.Filters;
using Microsoft.AspNetCore.Mvc;
using GymManagmentApplication.Domain.Constants;

namespace GymManagmentApplication.Controllers;

[ApiController]
[Route("api/dashboard")]
[AuthorizeRoles(RoleNames.Admin)]
public class DashboardController(IDashboardService service) : ControllerBase
{
    [HttpGet("overview")]
    public async Task<ActionResult<ApiResponse<object>>> GetOverview()
        => Ok(ApiResponse<object>.Ok(await service.GetOverviewAsync()));
}
