namespace GymManagmentApplication.Application.Support;

/// <summary>Help &amp; feedback services (job: Infrastructure/Jobs/SupportJob).</summary>
public static class SupportServicesRegistration
{
    public static IServiceCollection AddSupportServices(this IServiceCollection services)
    {
        services.AddScoped<SupportService>();
        services.AddScoped<SupportContentService>();
        services.AddScoped<ClassFeedbackService>();
        services.AddScoped<SupportJobService>();
        return services;
    }
}
