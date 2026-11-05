using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Shop.Catalog;
using GymManagmentApplication.Filters;
using Microsoft.AspNetCore.Mvc;

namespace GymManagmentApplication.Controllers;

/// <summary>
/// The gym shop's storefront for signed-in members: categories, products, reviews and the
/// wishlist. Ported from the Unique Lights catalog/review/wishlist endpoints.
/// </summary>
[ApiController]
[Route("api/shop")]
[AuthorizeRoles]
[RequireModule("shop")]
public class ShopCatalogController(
    IShopCategoryService categories,
    IShopProductService products,
    IShopReviewService reviews,
    IShopWishlistService wishlist) : ControllerBase
{
    // ── Categories ────────────────────────────────────────────────────────

    /// <summary>Active category tree (children nested, productCount includes sub-categories).</summary>
    [HttpGet("categories")]
    public async Task<ActionResult<ApiResponse<object>>> GetCategories()
        => Ok(ApiResponse<object>.Ok(await categories.GetTreeAsync()));

    [HttpGet("categories/{slug}")]
    public async Task<ActionResult<ApiResponse<object>>> GetCategory(string slug)
        => Ok(ApiResponse<object>.Ok(await categories.GetBySlugAsync(slug)));

    // ── Products ──────────────────────────────────────────────────────────

    [HttpGet("products")]
    public async Task<ActionResult<ApiResponse<object>>> SearchProducts([FromQuery] ShopProductQuery query)
        => Ok(ApiResponse<object>.Ok(await products.SearchAsync(query)));

    [HttpGet("products/filters")]
    public async Task<ActionResult<ApiResponse<object>>> GetFilters([FromQuery] string? category)
        => Ok(ApiResponse<object>.Ok(await products.GetFiltersAsync(category)));

    [HttpGet("products/suggest")]
    public async Task<ActionResult<ApiResponse<object>>> Suggest([FromQuery] string? q)
        => Ok(ApiResponse<object>.Ok(await products.SuggestAsync(q)));

    [HttpGet("products/{slug}")]
    public async Task<ActionResult<ApiResponse<object>>> GetProduct(string slug)
        => Ok(ApiResponse<object>.Ok(await products.GetBySlugAsync(slug)));

    [HttpGet("products/{slug}/related")]
    public async Task<ActionResult<ApiResponse<object>>> GetRelated(string slug)
        => Ok(ApiResponse<object>.Ok(await products.GetRelatedAsync(slug)));

    // ── Reviews ───────────────────────────────────────────────────────────

    [HttpGet("reviews/product/{productId}")]
    public async Task<ActionResult<ApiResponse<object>>> GetReviews(ulong productId, [FromQuery] int page = 1, [FromQuery] int pageSize = 12, [FromQuery] int? pageNumber = null)
        => Ok(ApiResponse<object>.Ok(await reviews.GetForProductAsync(productId, pageNumber ?? page, pageSize)));

    [HttpGet("reviews/product/{productId}/summary")]
    public async Task<ActionResult<ApiResponse<object>>> GetReviewSummary(ulong productId)
        => Ok(ApiResponse<object>.Ok(await reviews.GetSummaryAsync(productId)));

    [HttpPost("reviews")]
    public async Task<ActionResult<ApiResponse<object>>> CreateReview([FromBody] CreateShopReviewRequest request)
        => StatusCode(StatusCodes.Status201Created, ApiResponse<object>.Ok(await reviews.CreateAsync(request), "Thanks for your review"));

    [HttpDelete("reviews/{id}")]
    public async Task<ActionResult<ApiResponse<object>>> DeleteReview(ulong id)
    {
        await reviews.DeleteAsync(id);
        return Ok(ApiResponse<object>.Ok(null!, "Review deleted"));
    }

    // ── Wishlist ──────────────────────────────────────────────────────────

    [HttpGet("wishlist")]
    public async Task<ActionResult<ApiResponse<object>>> GetWishlist()
        => Ok(ApiResponse<object>.Ok(await wishlist.GetAsync()));

    [HttpPost("wishlist")]
    public async Task<ActionResult<ApiResponse<object>>> AddToWishlist([FromBody] AddShopWishlistItemRequest request)
        => Ok(ApiResponse<object>.Ok(await wishlist.AddAsync(request.ProductId), "Saved to wishlist"));

    [HttpDelete("wishlist/{productId}")]
    public async Task<ActionResult<ApiResponse<object>>> RemoveFromWishlist(ulong productId)
        => Ok(ApiResponse<object>.Ok(await wishlist.RemoveAsync(productId), "Removed from wishlist"));
}
