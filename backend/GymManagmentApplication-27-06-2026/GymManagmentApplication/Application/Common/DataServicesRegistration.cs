using GymManagmentApplication.Application.Shop.Orders;
using GymManagmentApplication.Infrastructure.Email;
using Microsoft.AspNetCore.Mvc;

namespace GymManagmentApplication.Application.Common;

/// <summary>Registers services added while fixing the architecture audit (data, billing, shop, scheduling).</summary>
public static class DataServicesRegistration
{
    public static IServiceCollection AddDataServices(this IServiceCollection services)
    {
        // ARCH-046: email outbox (CommunicationLogs rows) drained by a background sender.
        services.AddScoped<IEmailOutbox, EmailOutbox>();
        services.AddHostedService<EmailOutboxProcessor>();

        // ARCH-096: RuleException (409/422) and NotSupportedException (501) for every controller.
        services.Configure<MvcOptions>(o => o.Filters.Add(new ShopErrorsAttribute()));
        return services;
    }
}
