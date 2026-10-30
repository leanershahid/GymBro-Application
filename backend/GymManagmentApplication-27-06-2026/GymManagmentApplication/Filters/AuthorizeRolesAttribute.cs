using System.Net;
using System.Security.Claims;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Access;
using GymManagmentApplication.Domain.Constants;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Filters;

namespace GymManagmentApplication.Filters;

/// <summary>
/// Role gate. A listed role passes. Any other role — built-in, 'staff' or custom — still passes
/// when it was granted a module that unlocks the endpoint's <see cref="PermissionModuleAttribute"/>
/// key with the action implied by the HTTP method (see <see cref="IAccessService.CanAsync"/>), and
/// that module belongs to the app of one of the listed roles: admin-app modules open Admin
/// endpoints, trainer-app modules Trainer endpoints, member-app modules Client endpoints. So a
/// trainer granted Admin → Billing can use billing, but a trainer-app grant never opens an
/// admin-only endpoint.
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public class AuthorizeRolesAttribute(params string[] roles) : Attribute, IAsyncAuthorizationFilter
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

        if (roles.Length == 0) return;

        var userRole = user.FindFirstValue(ClaimTypes.Role) ?? string.Empty;
        if (roles.Any(r => r.Equals(userRole, StringComparison.OrdinalIgnoreCase))) return;

        // A super admin can do anything a tenant admin can.
        if (userRole.Equals(RoleNames.SuperAdmin, StringComparison.OrdinalIgnoreCase) &&
            roles.Any(r => r.Equals(RoleNames.Admin, StringComparison.OrdinalIgnoreCase)))
            return;

        if (await IsGrantedByModuleAsync(context, userRole, roles))
            return;

        context.Result = new JsonResult(ApiResponse<object>.Fail($"Forbidden. Required role(s): {string.Join(", ", roles)}."))
        {
            StatusCode = (int)HttpStatusCode.Forbidden
        };
    }

    private static async Task<bool> IsGrantedByModuleAsync(AuthorizationFilterContext context, string roleSlug, string[] roles)
    {
        // Method-level module wins over controller-level.
        var descriptor = context.ActionDescriptor as ControllerActionDescriptor;
        var module =
            descriptor?.MethodInfo.GetCustomAttributes(typeof(PermissionModuleAttribute), true)
                .Cast<PermissionModuleAttribute>().FirstOrDefault()?.Module
            ?? descriptor?.ControllerTypeInfo.GetCustomAttributes(typeof(PermissionModuleAttribute), true)
                .Cast<PermissionModuleAttribute>().FirstOrDefault()?.Module;
        if (module is null) return false;

        var action = context.HttpContext.Request.Method.ToUpperInvariant() switch
        {
            "GET" or "HEAD" => "view",
            "POST"          => "create",
            "PUT" or "PATCH"=> "edit",
            "DELETE"        => "delete",
            _               => null
        };
        if (action is null) return false;

        var currentUser = context.HttpContext.RequestServices.GetRequiredService<ICurrentUser>();
        if (currentUser.UserId is not { } userId) return false;

        // Only grants from the apps the listed roles use count.
        var apps = roles.Select(ModuleCatalog.AppForRole).Distinct().ToList();

        var service = context.HttpContext.RequestServices.GetRequiredService<IAccessService>();
        return await service.CanAsync(userId, roleSlug, module, action, apps);
    }
}
