namespace GymManagmentApplication.Application.Common;

/// <summary>Registers services added while fixing the architecture audit (access, roles, API-facing modules).</summary>
public static class ApiServicesRegistration
{
    public static IServiceCollection AddApiServices(this IServiceCollection services)
    {
        // Safety & compliance: waivers, health screening, emergency contacts, consents, booking/check-in gate.
        services.AddScoped<Safety.SafetyGate>();
        services.AddScoped<Safety.SafetyService>();
        services.AddScoped<Safety.ConsentService>();
        // Privacy controls: delete my account, download my data (jobs: Infrastructure/Jobs/PrivacyJobs).
        services.AddScoped<Privacy.PrivacyProcessor>();
        services.AddScoped<Privacy.PrivacyService>();
        // Member self-service: plan browser, join / checkout, pause / cancel / change requests (job: Infrastructure/Jobs/MembershipRequestJob).
        services.AddScoped<Billing.Services.SubscriptionService>();
        services.AddScoped<SelfService.SelfServicePlansService>();
        services.AddScoped<SelfService.MembershipRequestService>();
        // Cancellation & no-show rules: settings, standing, waive / lift (job: Infrastructure/Jobs/BookingRulesJob).
        services.AddScoped<Scheduling.BookingRulesService>();
        return services;
    }
}
