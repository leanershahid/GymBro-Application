using System.Net;
using System.Security.Claims;
using GymManagmentApplication.Application.Common;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace GymManagmentApplication.Filters;

[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public class AuthorizeRolesAttribute(params string[] roles) : Attribute, IAuthorizationFilter
{
    public void OnAuthorization(AuthorizationFilterContext context)
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

        if (roles.Length > 0)
        {
            var userRole = user.FindFirstValue(ClaimTypes.Role) ?? string.Empty;
            if (!roles.Any(r => r.Equals(userRole, StringComparison.OrdinalIgnoreCase)))
            {
                context.Result = new JsonResult(ApiResponse<object>.Fail($"Forbidden. Required role(s): {string.Join(", ", roles)}."))
                {
                    StatusCode = (int)HttpStatusCode.Forbidden
                };
            }
        }
    }
}
