namespace GymManagmentApplication.Application.Operations;

/// <summary>Opening hours, service status and announcements (roadmap feature 5).</summary>
public static class OperationsServicesRegistration
{
    public static IServiceCollection AddOperationsServices(this IServiceCollection services)
    {
        services.AddScoped<ServiceStatusService>();
        services.AddScoped<OpeningHoursService>();
        services.AddScoped<AnnouncementPublisher>();
        services.AddScoped<AnnouncementService>();
        return services;
    }
}
