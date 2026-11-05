namespace GymManagmentApplication.Application.Shop.Orders;

/// <summary>Registers the shop's buying services: cart, addresses, coupons, orders and the admin side of them.</summary>
public static class ShopOrdersRegistration
{
    public static IServiceCollection AddShopOrders(this IServiceCollection services)
    {
        // ARCH-001: cash on delivery only. The logging development gateway is used only in
        // Development; everywhere else the COD gateway refuses Card / UPI. Register a real
        // provider here when online shop payments are added.
        services.AddScoped<IShopPaymentGateway>(sp => sp.GetRequiredService<IHostEnvironment>().IsDevelopment()
            ? ActivatorUtilities.CreateInstance<DevelopmentShopPaymentGateway>(sp)
            : new CashOnDeliveryShopPaymentGateway());
        services.AddScoped<ShopOrderCore>();
        services.AddScoped<IShopCartService, ShopCartService>();
        services.AddScoped<IShopAddressService, ShopAddressService>();
        services.AddScoped<IShopCouponService, ShopCouponService>();
        services.AddScoped<IShopOrderService, ShopOrderService>();
        services.AddScoped<IShopAdminOrdersService, ShopAdminOrdersService>();
        services.AddScoped<IShopDashboardService, ShopDashboardService>();
        return services;
    }
}
