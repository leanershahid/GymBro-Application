namespace GymManagmentApplication.Application.Shop.Orders;

/// <summary>Registers the shop's buying services: cart, addresses, coupons, orders and the admin side of them.</summary>
public static class ShopOrdersRegistration
{
    public static IServiceCollection AddShopOrders(this IServiceCollection services)
    {
        // Development stub: no money moves. Swap for a real provider here.
        services.AddScoped<IShopPaymentGateway, DevelopmentShopPaymentGateway>();
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
