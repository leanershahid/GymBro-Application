using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Shop.Catalog;
using GymManagmentApplication.Domain.Constants;
using GymManagmentApplication.Filters;
using Microsoft.AspNetCore.Mvc;

namespace GymManagmentApplication.Controllers;

/// <summary>
/// The gym shop's back office: products (with variants and images), categories and stock.
/// Ported from the Unique Lights admin products/categories/inventory endpoints.
/// </summary>
[ApiController]
[Route("api/shop/admin")]
[AuthorizeRoles(RoleNames.Admin)]
[PermissionModule("shop")]
[RequireModule("shop")]
public class ShopAdminCatalogController(
    IShopAdminProductService products,
    IShopAdminCategoryService categories,
    IShopInventoryService inventory) : ControllerBase
{
    // ── Products ──────────────────────────────────────────────────────────

    [HttpGet("products")]
    public async Task<ActionResult<ApiResponse<object>>> ListProducts([FromQuery] ShopAdminProductQuery query)
        => Ok(ApiResponse<object>.Ok(await products.SearchAsync(query)));

    [HttpGet("products/{id}")]
    public async Task<ActionResult<ApiResponse<object>>> GetProduct(ulong id)
        => Ok(ApiResponse<object>.Ok(await products.GetAsync(id)));

    [HttpPost("products")]
    public async Task<ActionResult<ApiResponse<object>>> CreateProduct([FromBody] UpsertShopProductRequest request)
        => StatusCode(StatusCodes.Status201Created, ApiResponse<object>.Ok(await products.CreateAsync(request), "Product created"));

    [HttpPut("products/{id}")]
    public async Task<ActionResult<ApiResponse<object>>> UpdateProduct(ulong id, [FromBody] UpsertShopProductRequest request)
        => Ok(ApiResponse<object>.Ok(await products.UpdateAsync(id, request), "Product updated"));

    [HttpDelete("products/{id}")]
    public async Task<ActionResult<ApiResponse<object>>> DeleteProduct(ulong id)
    {
        await products.DeleteAsync(id);
        return Ok(ApiResponse<object>.Ok(null!, "Product deleted"));
    }

    // ── Variants ──────────────────────────────────────────────────────────

    [HttpPost("products/{id}/variants")]
    public async Task<ActionResult<ApiResponse<object>>> AddVariant(ulong id, [FromBody] UpsertShopVariantRequest request)
        => Ok(ApiResponse<object>.Ok(await products.AddVariantAsync(id, request), "Variant added"));

    [HttpPut("products/{id}/variants/{variantId}")]
    public async Task<ActionResult<ApiResponse<object>>> UpdateVariant(ulong id, ulong variantId, [FromBody] UpsertShopVariantRequest request)
        => Ok(ApiResponse<object>.Ok(await products.UpdateVariantAsync(id, variantId, request), "Variant updated"));

    [HttpDelete("products/{id}/variants/{variantId}")]
    public async Task<ActionResult<ApiResponse<object>>> DeleteVariant(ulong id, ulong variantId)
        => Ok(ApiResponse<object>.Ok(await products.DeleteVariantAsync(id, variantId), "Variant deleted"));

    // ── Images ────────────────────────────────────────────────────────────

    /// <summary>multipart/form-data: file (jpg/png/webp/heic, max 5 MB), altText, isPrimary.</summary>
    [HttpPost("products/{id}/images")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(6 * 1024 * 1024)]
    public async Task<ActionResult<ApiResponse<object>>> UploadImage(ulong id, [FromForm] UploadShopImageRequest request)
        => Ok(ApiResponse<object>.Ok(await products.UploadImageAsync(id, request), "Image uploaded"));

    [HttpPost("products/{id}/images/url")]
    public async Task<ActionResult<ApiResponse<object>>> AddImageUrl(ulong id, [FromBody] AddShopImageUrlRequest request)
        => Ok(ApiResponse<object>.Ok(await products.AddImageUrlAsync(id, request), "Image added"));

    [HttpPatch("products/{id}/images/{imageId}")]
    public async Task<ActionResult<ApiResponse<object>>> UpdateImage(ulong id, ulong imageId, [FromBody] UpdateShopImageRequest request)
        => Ok(ApiResponse<object>.Ok(await products.UpdateImageAsync(id, imageId, request), "Image updated"));

    [HttpDelete("products/{id}/images/{imageId}")]
    public async Task<ActionResult<ApiResponse<object>>> DeleteImage(ulong id, ulong imageId)
        => Ok(ApiResponse<object>.Ok(await products.DeleteImageAsync(id, imageId), "Image deleted"));

    // ── Categories ────────────────────────────────────────────────────────

    /// <summary>Flat list of every (non-deleted) category, inactive ones included.</summary>
    [HttpGet("categories")]
    public async Task<ActionResult<ApiResponse<object>>> ListCategories()
        => Ok(ApiResponse<object>.Ok(await categories.GetAllAsync()));

    [HttpPost("categories")]
    public async Task<ActionResult<ApiResponse<object>>> CreateCategory([FromBody] UpsertShopCategoryRequest request)
        => StatusCode(StatusCodes.Status201Created, ApiResponse<object>.Ok(await categories.CreateAsync(request), "Category created"));

    [HttpPut("categories/{id}")]
    public async Task<ActionResult<ApiResponse<object>>> UpdateCategory(ulong id, [FromBody] UpsertShopCategoryRequest request)
        => Ok(ApiResponse<object>.Ok(await categories.UpdateAsync(id, request), "Category updated"));

    [HttpDelete("categories/{id}")]
    public async Task<ActionResult<ApiResponse<object>>> DeleteCategory(ulong id)
    {
        await categories.DeleteAsync(id);
        return Ok(ApiResponse<object>.Ok(null!, "Category deleted"));
    }

    // ── Inventory ─────────────────────────────────────────────────────────

    [HttpGet("inventory")]
    public async Task<ActionResult<ApiResponse<object>>> ListInventory([FromQuery] ShopInventoryQuery query)
        => Ok(ApiResponse<object>.Ok(await inventory.SearchAsync(query)));

    [HttpPatch("inventory/{variantId}")]
    public async Task<ActionResult<ApiResponse<object>>> UpdateInventory(ulong variantId, [FromBody] UpdateShopInventoryRequest request)
        => Ok(ApiResponse<object>.Ok(await inventory.UpdateAsync(variantId, request), "Inventory updated"));
}
