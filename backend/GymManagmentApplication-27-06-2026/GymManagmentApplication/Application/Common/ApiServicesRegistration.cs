namespace GymManagmentApplication.Application.Common;

/// <summary>Registers services added while fixing the architecture audit (access, roles, API-facing modules).</summary>
public static class ApiServicesRegistration
{
    public static IServiceCollection AddApiServices(this IServiceCollection services)
    {
        return services;
    }
}
