using System.Net;
using System.Security.Claims;
using GymManagmentApplication.Application.Access;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Domain.Constants;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace GymManagmentApplication.Filters;

/// <summary>
/// Gates an endpoint behind an API permission key, IN ADDITION to <see cref="AuthorizeRolesAttribute"/>
/// — the role decides what is possible in general, this decides whether the user has been granted a
/// module that unlocks the key, with the action implied by the HTTP method (GET = view, POST = create,
/// PUT/PATCH = edit, DELETE = delete). It is the same decision for every role, made by
/// <see cref="IAccessService.CanAsync"/> from the user's role grants and per-user overrides, so hiding a
/// module in the admin app's access screens also blocks its API. Super admins always pass.
/// Never apply this to the access management endpoints themselves, or an admin who removes their
/// own access to a module could lock themselves out of restoring it.
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public class RequireModuleAttribute(string moduleKey) : Attribute, IAsyncAuthorizationFilter
{
    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        var user = context.HttpContext.User;

        if (user.Identity is null || !user.Identity.IsAuthenticated ||
            !ulong.TryParse(user.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
        {
            Deny(context, HttpStatusCode.Unauthorized, "Unauthorized. Token is missing or invalid.");
            return;
        }

        var role = user.FindFirstValue(ClaimTypes.Role) ?? string.Empty;
        if (role.Equals(RoleNames.SuperAdmin, StringComparison.OrdinalIgnoreCase))
            return;

        var action = context.HttpContext.Request.Method.ToUpperInvariant() switch
        {
            "GET" or "HEAD"  => "view",
            "POST"           => "create",
            "PUT" or "PATCH" => "edit",
            "DELETE"         => "delete",
            _                => "view"
        };

        var service = context.HttpContext.RequestServices.GetRequiredService<IAccessService>();
        if (!await service.CanAsync(userId, role, moduleKey, action))
            Deny(context, HttpStatusCode.Forbidden, $"You don't have {action} access to the '{moduleKey}' module.");
    }

    private static void Deny(AuthorizationFilterContext context, HttpStatusCode status, string message) =>
        context.Result = new JsonResult(ApiResponse<object>.Fail(message)) { StatusCode = (int)status };
}
