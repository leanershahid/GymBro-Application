using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Shop.Common;
using GymManagmentApplication.Application.Shop.Orders;
using GymManagmentApplication.Domain.Constants;
using GymManagmentApplication.Domain.Entities.Shop;
using GymManagmentApplication.Filters;
using Microsoft.AspNetCore.Mvc;

namespace GymManagmentApplication.Controllers;

/// <summary>
/// The gym's shop back office for orders: dashboard, orders and their status, buyers, coupons and
/// shop settings. Ported from the Unique Lights admin dashboard/orders/customers/coupons endpoints.
/// </summary>
[ApiController]
[Route("api/shop/admin")]
[AuthorizeRoles(RoleNames.Admin)]
[PermissionModule("shop")]
[RequireModule("shop")]
[ShopErrors]
public class ShopAdminOrdersController(
    IShopDashboardService dashboard,
    IShopAdminOrdersService orders,
    IShopCouponService coupons,
    IShopSettingsService settings) : ControllerBase
{
    // ── Dashboard ─────────────────────────────────────────────────────────

    [HttpGet("dashboard")]
    public async Task<ActionResult<ApiResponse<object>>> GetDashboard()
        => Ok(ApiResponse<object>.Ok(await dashboard.GetAsync()));

    // ── Orders ────────────────────────────────────────────────────────────

    /// <summary>Orders, newest first; filter by status, search by order number, email or name.</summary>
    [HttpGet("orders")]
    public async Task<ActionResult<ApiResponse<object>>> GetOrders(
        [FromQuery] ShopOrderStatus? status, [FromQuery] string? search,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 12)
        => Ok(ApiResponse<object>.Ok(await orders.SearchAsync(status, search, page, pageSize)));

    [HttpGet("orders/{orderNumber}")]
    public async Task<ActionResult<ApiResponse<object>>> GetOrder(string orderNumber)
        => Ok(ApiResponse<object>.Ok(await orders.GetAsync(orderNumber)));

    [HttpPatch("orders/{orderNumber}/status")]
    public async Task<ActionResult<ApiResponse<object>>> UpdateOrderStatus(string orderNumber, [FromBody] ShopUpdateOrderStatusRequest request)
        => Ok(ApiResponse<object>.Ok(await orders.UpdateStatusAsync(orderNumber, request), "Order status updated"));

    // ── Customers ─────────────────────────────────────────────────────────

    /// <summary>People who have shop orders or a cart; search by name, email or phone.</summary>
    [HttpGet("customers")]
    public async Task<ActionResult<ApiResponse<object>>> GetCustomers(
        [FromQuery] string? search, [FromQuery] int page = 1, [FromQuery] int pageSize = 12)
        => Ok(ApiResponse<object>.Ok(await orders.SearchCustomersAsync(search, page, pageSize)));

    [HttpGet("customers/{id}")]
    public async Task<ActionResult<ApiResponse<object>>> GetCustomer(ulong id)
        => Ok(ApiResponse<object>.Ok(await orders.GetCustomerAsync(id)));

    // ── Coupons ───────────────────────────────────────────────────────────

    [HttpGet("coupons")]
    public async Task<ActionResult<ApiResponse<object>>> GetCoupons()
        => Ok(ApiResponse<object>.Ok(await coupons.GetAllAsync()));

    [HttpPost("coupons")]
    public async Task<ActionResult<ApiResponse<object>>> CreateCoupon([FromBody] ShopUpsertCouponRequest request)
        => StatusCode(StatusCodes.Status201Created, ApiResponse<object>.Ok(await coupons.CreateAsync(request), "Coupon created"));

    [HttpPut("coupons/{id}")]
    public async Task<ActionResult<ApiResponse<object>>> UpdateCoupon(ulong id, [FromBody] ShopUpsertCouponRequest request)
        => Ok(ApiResponse<object>.Ok(await coupons.UpdateAsync(id, request), "Coupon updated"));

    [HttpDelete("coupons/{id}")]
    public async Task<ActionResult<ApiResponse<object>>> DeleteCoupon(ulong id)
    {
        await coupons.DeleteAsync(id);
        return Ok(ApiResponse<object>.Ok(null!, "Coupon deleted"));
    }

    // ── Settings ──────────────────────────────────────────────────────────

    [HttpGet("settings")]
    public async Task<ActionResult<ApiResponse<object>>> GetSettings()
        => Ok(ApiResponse<object>.Ok(await settings.GetAsync()));

    [HttpPut("settings")]
    public async Task<ActionResult<ApiResponse<object>>> UpdateSettings([FromBody] ShopSettings request)
        => Ok(ApiResponse<object>.Ok(await settings.UpdateAsync(request), "Shop settings saved"));
}
