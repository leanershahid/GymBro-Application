using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Shop.Common;
using GymManagmentApplication.Application.Shop.Orders;
using GymManagmentApplication.Filters;
using Microsoft.AspNetCore.Mvc;

namespace GymManagmentApplication.Controllers;

/// <summary>
/// The gym shop's buying side for signed-in members: store settings, cart, coupons, checkout,
/// orders and delivery addresses. Ported from the Unique Lights cart/coupon/order/address endpoints.
/// </summary>
[ApiController]
[Route("api/shop")]
[AuthorizeRoles]
[RequireModule("shop")]
[ShopErrors]
public class ShopOrdersController(
    IShopSettingsService settings,
    IShopCartService cart,
    IShopCouponService coupons,
    IShopOrderService orders,
    IShopAddressService addresses) : ControllerBase
{
    // ── Store ─────────────────────────────────────────────────────────────

    /// <summary>Pricing rules, delivery promises and contact details for the shop pages.</summary>
    [HttpGet("store")]
    public async Task<ActionResult<ApiResponse<object>>> GetStore()
    {
        var s = await settings.GetAsync();
        return Ok(ApiResponse<object>.Ok(new ShopStoreSettingsDto(
            s.Name, s.Tagline, s.Currency, s.TaxRate, s.FreeShippingThreshold, s.StandardShipping, s.ExpressShipping,
            s.StandardDeliveryDays, s.ExpressDeliveryDays, s.ReturnDays, s.SupportEmail, s.SupportPhone, s.Address, s.BusinessHours)));
    }

    // ── Cart ──────────────────────────────────────────────────────────────

    [HttpGet("cart")]
    public async Task<ActionResult<ApiResponse<object>>> GetCart()
        => Ok(ApiResponse<object>.Ok(await cart.GetAsync()));

    [HttpPost("cart/items")]
    public async Task<ActionResult<ApiResponse<object>>> AddCartItem([FromBody] ShopAddCartItemRequest request)
        => Ok(ApiResponse<object>.Ok(await cart.AddItemAsync(request), "Added to cart"));

    [HttpPatch("cart/items/{itemId}")]
    public async Task<ActionResult<ApiResponse<object>>> UpdateCartItem(ulong itemId, [FromBody] ShopUpdateCartItemRequest request)
        => Ok(ApiResponse<object>.Ok(await cart.UpdateItemAsync(itemId, request), "Cart updated"));

    [HttpDelete("cart/items/{itemId}")]
    public async Task<ActionResult<ApiResponse<object>>> RemoveCartItem(ulong itemId)
        => Ok(ApiResponse<object>.Ok(await cart.RemoveItemAsync(itemId), "Item removed"));

    [HttpDelete("cart")]
    public async Task<ActionResult<ApiResponse<object>>> ClearCart()
        => Ok(ApiResponse<object>.Ok(await cart.ClearAsync(), "Cart cleared"));

    // ── Coupons ───────────────────────────────────────────────────────────

    [HttpPost("coupons/validate")]
    public async Task<ActionResult<ApiResponse<object>>> ValidateCoupon([FromBody] ShopValidateCouponRequest request)
        => Ok(ApiResponse<object>.Ok(await coupons.ValidateAsync(request), "Coupon applied"));

    // ── Checkout & orders ─────────────────────────────────────────────────

    /// <summary>Totals for the current cart. An unusable coupon comes back as couponMessage instead of failing.</summary>
    [HttpPost("orders/quote")]
    public async Task<ActionResult<ApiResponse<object>>> Quote([FromBody] ShopCheckoutQuoteRequest request)
        => Ok(ApiResponse<object>.Ok(await orders.QuoteAsync(request)));

    [HttpPost("orders")]
    public async Task<ActionResult<ApiResponse<object>>> PlaceOrder([FromBody] ShopCreateOrderRequest request)
        => StatusCode(StatusCodes.Status201Created, ApiResponse<object>.Ok(await orders.CreateAsync(request), "Order placed"));

    [HttpGet("orders")]
    public async Task<ActionResult<ApiResponse<object>>> GetMyOrders([FromQuery] int page = 1, [FromQuery] int pageSize = 12, [FromQuery] int? pageNumber = null)
        => Ok(ApiResponse<object>.Ok(await orders.GetMyOrdersAsync(pageNumber ?? page, pageSize)));

    [HttpGet("orders/{orderNumber}")]
    public async Task<ActionResult<ApiResponse<object>>> GetMyOrder(string orderNumber)
        => Ok(ApiResponse<object>.Ok(await orders.GetMyOrderAsync(orderNumber)));

    [HttpPost("orders/{orderNumber}/cancel")]
    public async Task<ActionResult<ApiResponse<object>>> CancelMyOrder(string orderNumber)
        => Ok(ApiResponse<object>.Ok(await orders.CancelMyOrderAsync(orderNumber), "Order cancelled"));

    // ── Addresses ─────────────────────────────────────────────────────────

    [HttpGet("addresses")]
    public async Task<ActionResult<ApiResponse<object>>> GetAddresses()
        => Ok(ApiResponse<object>.Ok(await addresses.GetAllAsync()));

    [HttpPost("addresses")]
    public async Task<ActionResult<ApiResponse<object>>> CreateAddress([FromBody] ShopAddressRequest request)
        => StatusCode(StatusCodes.Status201Created, ApiResponse<object>.Ok(await addresses.CreateAsync(request), "Address added"));

    [HttpPut("addresses/{id}")]
    public async Task<ActionResult<ApiResponse<object>>> UpdateAddress(ulong id, [FromBody] ShopAddressRequest request)
        => Ok(ApiResponse<object>.Ok(await addresses.UpdateAsync(id, request), "Address updated"));

    [HttpPatch("addresses/{id}/default")]
    public async Task<ActionResult<ApiResponse<object>>> SetDefaultAddress(ulong id)
        => Ok(ApiResponse<object>.Ok(await addresses.SetDefaultAsync(id), "Default address updated"));

    [HttpDelete("addresses/{id}")]
    public async Task<ActionResult<ApiResponse<object>>> DeleteAddress(ulong id)
    {
        await addresses.DeleteAsync(id);
        return Ok(ApiResponse<object>.Ok(null!, "Address removed"));
    }
}
