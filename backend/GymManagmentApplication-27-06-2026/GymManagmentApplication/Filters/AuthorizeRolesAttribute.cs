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
/// Role gate. Built-in roles (superadmin/admin/trainer/client) pass only when listed.
/// Any other role — 'staff' or an admin-defined custom role — passes when its module grants
/// (see <see cref="IAccessService.CanAsync"/>) allow the action implied by the HTTP method on the
/// endpoint's <see cref="PermissionModuleAttribute"/> key.
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

        if (!RoleNames.IsBuiltIn(userRole) && await IsGrantedByMatrixAsync(context, userRole))
            return;

        context.Result = new JsonResult(ApiResponse<object>.Fail($"Forbidden. Required role(s): {string.Join(", ", roles)}."))
        {
            StatusCode = (int)HttpStatusCode.Forbidden
        };
    }

    private static async Task<bool> IsGrantedByMatrixAsync(AuthorizationFilterContext context, string roleSlug)
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

        var service = context.HttpContext.RequestServices.GetRequiredService<IAccessService>();
        return await service.CanAsync(userId, roleSlug, module, action);
    }
}
