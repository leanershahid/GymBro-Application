namespace GymManagmentApplication.Application.Facilities;

/// <summary>Equipment register, problem reports and the incident log (roadmap feature 7).</summary>
public static class FacilitiesServicesRegistration
{
    public static IServiceCollection AddFacilitiesServices(this IServiceCollection services)
    {
        services.AddScoped<FacilityAssetService>();
        services.AddScoped<FacilityReportService>();
        services.AddScoped<IncidentService>();
        return services;
    }
}
