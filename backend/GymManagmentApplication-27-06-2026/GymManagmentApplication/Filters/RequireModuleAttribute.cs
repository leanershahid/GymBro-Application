using System.Net;
using System.Security.Claims;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.UserModules.Interfaces;
using GymManagmentApplication.Domain.Constants;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace GymManagmentApplication.Filters;

/// <summary>
/// Gates an endpoint behind a per-user feature module, IN ADDITION to
/// <see cref="AuthorizeRolesAttribute"/> — role decides what actions are possible in general,
/// this decides whether the feature area (and the specific view/create/edit/delete action
/// implied by the HTTP method) is enabled for this specific user — including admins.
/// An admin with no explicit <c>UserModuleAccess</c> row for a module defaults to allowed
/// (see <see cref="IUserModulesService.CanAsync"/>) — their access is a privilege dialed down
/// by exception, not granted from zero — so existing admins aren't locked out by this change.
/// Never apply this to the module-access management endpoints themselves, or an admin who
/// disables their own access to a module could lock themselves out of re-enabling it.
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

        // Staff/custom roles are governed by the role/module matrix in AuthorizeRoles instead
        // of these per-user feature toggles.
        if (!RoleNames.IsBuiltIn(role))
            return;

        if (!ulong.TryParse(user.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
        {
            context.Result = new JsonResult(ApiResponse<object>.Fail("Unauthorized. Token is missing or invalid."))
            {
                StatusCode = (int)HttpStatusCode.Unauthorized
            };
            return;
        }

        var action = context.HttpContext.Request.Method.ToUpperInvariant() switch
        {
            "GET" or "HEAD"  => "view",
            "POST"           => "create",
            "PUT" or "PATCH" => "edit",
            "DELETE"         => "delete",
            _                => "view"
        };

        var service = context.HttpContext.RequestServices.GetRequiredService<IUserModulesService>();
        var allowed = await service.CanAsync(userId, moduleKey, action);

        if (!allowed)
        {
            context.Result = new JsonResult(ApiResponse<object>.Fail($"You don't have {action} access to the '{moduleKey}' module."))
            {
                StatusCode = (int)HttpStatusCode.Forbidden
            };
        }
    }
}
