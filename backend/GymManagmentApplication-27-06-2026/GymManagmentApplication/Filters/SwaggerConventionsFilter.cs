using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace GymManagmentApplication.Filters;

/// <summary>
/// Swagger-only documentation of API conventions that the code can't express per action:
/// <list type="bullet">
/// <item>The optional <c>tenantId</c> query parameter some endpoints accept (ARCH-103) only matters to
/// super admins, who may target another gym; for everyone else it is ignored and their own gym is used.</item>
/// <item>Anonymous vs. signed-in: endpoints without [AllowAnonymous] require a bearer token (fallback policy).</item>
/// </list>
/// </summary>
public class SwaggerConventionsFilter : IOperationFilter
{
    public void Apply(OpenApiOperation operation, OperationFilterContext context)
    {
        foreach (var p in operation.Parameters.Where(p => p.In == ParameterLocation.Query &&
                                                          p.Name.Equals("tenantId", StringComparison.OrdinalIgnoreCase)))
            p.Description = "Super admin only: the gym to act on. Ignored for every other role (their own gym is used).";

        var anonymous = context.ApiDescription.ActionDescriptor.EndpointMetadata
            .OfType<Microsoft.AspNetCore.Authorization.IAllowAnonymous>().Any();
        if (anonymous) operation.Security = [];
    }
}
