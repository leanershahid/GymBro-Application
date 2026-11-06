using GymManagmentApplication.Application.Shop.Orders;
using Microsoft.AspNetCore.Mvc;

namespace GymManagmentApplication.Application.Common;

/// <summary>Registers services added while fixing the architecture audit (data, billing, shop, scheduling).</summary>
public static class DataServicesRegistration
{
    public static IServiceCollection AddDataServices(this IServiceCollection services)
    {
        // ARCH-046's email outbox is an Infrastructure implementation: registered in Program.cs (ARCH-022).

        // ARCH-096: RuleException (409/422) and NotSupportedException (501) for every controller.
        services.Configure<MvcOptions>(o => o.Filters.Add(new ShopErrorsAttribute()));
        return services;
    }
}
