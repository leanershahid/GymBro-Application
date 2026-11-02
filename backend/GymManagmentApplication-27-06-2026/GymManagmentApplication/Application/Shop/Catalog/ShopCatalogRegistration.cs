namespace GymManagmentApplication.Application.Shop.Catalog;

/// <summary>Registers the shop's catalog services: categories, products, reviews, wishlist and the admin catalog.</summary>
public static class ShopCatalogRegistration
{
    public static IServiceCollection AddShopCatalog(this IServiceCollection services)
    {
        services.AddScoped<IShopProductQueries, ShopProductQueries>();
        services.AddScoped<IShopCategoryService, ShopCategoryService>();
        services.AddScoped<IShopProductService, ShopProductService>();
        services.AddScoped<IShopReviewService, ShopReviewService>();
        services.AddScoped<IShopWishlistService, ShopWishlistService>();
        services.AddScoped<IShopAdminProductService, ShopAdminProductService>();
        services.AddScoped<IShopAdminCategoryService, ShopAdminCategoryService>();
        services.AddScoped<IShopInventoryService, ShopInventoryService>();
        return services;
    }
}
