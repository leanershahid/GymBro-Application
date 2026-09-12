using System.Net;
using System.Security.Claims;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.UserModules.Interfaces;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace GymManagmentApplication.Filters;

/// <summary>
/// Gates an endpoint behind a per-user feature module, IN ADDITION to
/// <see cref="AuthorizeRolesAttribute"/> — role decides what actions are
/// possible, this decides whether the feature area is enabled at all for
/// this specific Trainer/Client. Admins always bypass this check.
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public class RequireModuleAttribute(string moduleKey) : Attribute, IAsyncAuthorizationFilter
{
    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        var user = context.HttpContext.User;

        if (user.Identity is null || !user.Identity.IsAuthenticated)
        {
            context.Result = new JsonResult(ApiResponse<object>.Fail("Unauthorized. Token is missing or invalid."))
            {
                StatusCode = (int)HttpStatusCode.Unauthorized
            };
            return;
        }

        var role = user.FindFirstValue(ClaimTypes.Role) ?? string.Empty;
        if (role.Equals("admin", StringComparison.OrdinalIgnoreCase))
            return; // Admins bypass module gating entirely.

        if (!ulong.TryParse(user.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
        {
            context.Result = new JsonResult(ApiResponse<object>.Fail("Unauthorized. Token is missing or invalid."))
            {
                StatusCode = (int)HttpStatusCode.Unauthorized
            };
            return;
        }

        var service = context.HttpContext.RequestServices.GetRequiredService<IUserModulesService>();
        var hasAccess = await service.HasModuleAsync(userId, moduleKey);

        if (!hasAccess)
        {
            context.Result = new JsonResult(ApiResponse<object>.Fail($"The '{moduleKey}' module is not enabled for this account."))
            {
                StatusCode = (int)HttpStatusCode.Forbidden
            };
        }
    }
}
