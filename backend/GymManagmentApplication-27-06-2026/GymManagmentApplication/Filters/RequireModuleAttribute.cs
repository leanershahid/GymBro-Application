using System.Net;
using System.Security.Claims;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.ModuleAccess.Interfaces;
using GymManagmentApplication.Application.UserModules.Interfaces;
using GymManagmentApplication.Domain.Constants;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace GymManagmentApplication.Filters;

/// <summary>
/// Gates an endpoint behind a feature module, IN ADDITION to <see cref="AuthorizeRolesAttribute"/>
/// — role decides what actions are possible in general, this decides whether the feature area
/// (and the specific view/create/edit/delete action implied by the HTTP method) is enabled:
/// <list type="bullet">
/// <item>Admin/SuperAdmin: governed by the per-role Module Access matrix (the same "Role Access"
/// screen an admin uses to configure custom roles) via <see cref="IModuleAccessService.IsAllowedForRoleAsync"/>
/// — so toggling, say, Trainers → Delete off for the Admin role there actually hides/blocks it.
/// An admin role with no explicit row for a module defaults to allowed (privilege dialed down
/// by exception, not granted from zero), so existing admins aren't locked out by this change.</item>
/// <item>Trainer/Client: governed by their own per-user <c>UserModuleAccess</c> row (the
/// "Manage Access" screen for one specific person) via <see cref="IUserModulesService.CanAsync"/>
/// — this is the member/trainer app's own feature-module toggle (workouts, exercises, etc.),
/// unrelated to the admin-area Module Access matrix.</item>
/// <item>Staff/custom roles: skipped here — already governed by the role/module matrix inside
/// <see cref="AuthorizeRolesAttribute"/>.</item>
/// </list>
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
            Deny(context, HttpStatusCode.Unauthorized, "Unauthorized. Token is missing or invalid.");
            return;
        }

        var role = user.FindFirstValue(ClaimTypes.Role) ?? string.Empty;

        // Staff/custom roles are governed by the role/module matrix in AuthorizeRoles instead
        // of the checks below.
        if (!RoleNames.IsBuiltIn(role))
            return;

        var action = context.HttpContext.Request.Method.ToUpperInvariant() switch
        {
            "GET" or "HEAD"  => "view",
            "POST"           => "create",
            "PUT" or "PATCH" => "edit",
            "DELETE"         => "delete",
            _                => "view"
        };

        bool allowed;
        if (role.Equals(RoleNames.Admin, StringComparison.OrdinalIgnoreCase) ||
            role.Equals(RoleNames.SuperAdmin, StringComparison.OrdinalIgnoreCase))
        {
            var currentUser = context.HttpContext.RequestServices.GetRequiredService<ICurrentUser>();
            if (currentUser.TenantId is not { } tenantId)
            {
                Deny(context, HttpStatusCode.Unauthorized, "Unauthorized. Token is missing or invalid.");
                return;
            }
            var moduleAccessService = context.HttpContext.RequestServices.GetRequiredService<IModuleAccessService>();
            allowed = await moduleAccessService.IsAllowedForRoleAsync(tenantId, role, moduleKey, action);
        }
        else
        {
            if (!ulong.TryParse(user.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
            {
                Deny(context, HttpStatusCode.Unauthorized, "Unauthorized. Token is missing or invalid.");
                return;
            }
            var service = context.HttpContext.RequestServices.GetRequiredService<IUserModulesService>();
            allowed = await service.CanAsync(userId, moduleKey, action);
        }

        if (!allowed)
            Deny(context, HttpStatusCode.Forbidden, $"You don't have {action} access to the '{moduleKey}' module.");
    }

    private static void Deny(AuthorizationFilterContext context, HttpStatusCode status, string message) =>
        context.Result = new JsonResult(ApiResponse<object>.Fail(message)) { StatusCode = (int)status };
}
