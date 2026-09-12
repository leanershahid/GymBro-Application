using GymManagmentApplication.Application.AiCoach.Interfaces;
using GymManagmentApplication.Application.AiCoach.Requests;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Filters;
using Microsoft.AspNetCore.Mvc;
using GymManagmentApplication.Domain.Constants;

namespace GymManagmentApplication.Controllers;

[ApiController]
[Route("api/ai-coach")]
[AuthorizeRoles(RoleNames.Admin)]
public class AiCoachController(IAiCoachSettingsService service) : ControllerBase
{
    [HttpGet("settings")]
    public async Task<ActionResult<ApiResponse<object>>> GetSettings()
        => Ok(ApiResponse<object>.Ok(await service.GetSettingsAsync()));

    [HttpPut("settings")]
    public async Task<ActionResult<ApiResponse<object>>> SaveSettings([FromBody] AiCoachSettingsRequest request)
        => Ok(ApiResponse<object>.Ok(await service.SaveSettingsAsync(request), "AI Coach settings saved."));
}
