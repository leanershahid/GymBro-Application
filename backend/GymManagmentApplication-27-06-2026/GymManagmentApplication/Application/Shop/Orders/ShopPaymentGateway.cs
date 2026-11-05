using GymManagmentApplication.Domain.Entities.Shop;

namespace GymManagmentApplication.Application.Shop.Orders;

/// <param name="IdempotencyKey">
/// Stable per order ("shop-order-{tenant}-{order}"): a real provider must treat a repeated key as the
/// same charge, so a retried request can never take the money twice.
/// </param>
public sealed record ShopPaymentRequest(ulong OrderId, ShopPaymentMethod Method, decimal Amount, string Currency, string IdempotencyKey);

public sealed record ShopPaymentResult(ShopPaymentStatus Status, string? TransactionReference, DateTime? PaidAt, string? FailureReason);

/// <summary>
/// The shop's payment provider. Only cash on delivery is offered today (ARCH-001): no online
/// provider is wired up, so Card / UPI are refused at checkout. To add one (e.g. Razorpay, as in
/// billing) implement this interface, make <see cref="Supports"/> return true for its methods and
/// register it in <see cref="ShopOrdersRegistration"/>. The gateway is always called outside any
/// database transaction, once per order, with <see cref="ShopPaymentRequest.IdempotencyKey"/>.
/// </summary>
public interface IShopPaymentGateway
{
    bool Supports(ShopPaymentMethod method);
    Task<ShopPaymentResult> ChargeAsync(ShopPaymentRequest request, CancellationToken ct = default);
    Task<ShopPaymentResult> RefundAsync(ShopPayment payment, CancellationToken ct = default);
}

public static class ShopPayments
{
    public const string OnlyCashOnDelivery = "Only cash on delivery is available right now.";
}

/// <summary>
/// Production gateway: cash on delivery only. COD → Pending (marked Paid when the order is
/// delivered). A COD refund is money handed back by the gym, so it is simply recorded.
/// </summary>
public sealed class CashOnDeliveryShopPaymentGateway : IShopPaymentGateway
{
    public bool Supports(ShopPaymentMethod method) => method == ShopPaymentMethod.CashOnDelivery;

    public Task<ShopPaymentResult> ChargeAsync(ShopPaymentRequest request, CancellationToken ct = default) =>
        Task.FromResult(Supports(request.Method)
            ? new ShopPaymentResult(ShopPaymentStatus.Pending, null, null, null)
            : new ShopPaymentResult(ShopPaymentStatus.Failed, null, null, ShopPayments.OnlyCashOnDelivery));

    public Task<ShopPaymentResult> RefundAsync(ShopPayment payment, CancellationToken ct = default) =>
        Task.FromResult(payment.Method == ShopPaymentMethod.CashOnDelivery
            ? new ShopPaymentResult(ShopPaymentStatus.Refunded, payment.TransactionReference, payment.PaidAt, null)
            : throw new InvalidOperationException("No online payment provider is configured to refund this payment."));
}

/// <summary>
/// DEVELOPMENT ONLY (registered only when ASPNETCORE_ENVIRONMENT=Development) — moves no money.
/// Behaves like <see cref="CashOnDeliveryShopPaymentGateway"/> (Card / UPI are not offered) and logs
/// every call so checkout can be traced locally.
/// </summary>
public sealed class DevelopmentShopPaymentGateway(ILogger<DevelopmentShopPaymentGateway> logger) : IShopPaymentGateway
{
    private readonly CashOnDeliveryShopPaymentGateway inner = new();

    public bool Supports(ShopPaymentMethod method) => inner.Supports(method);

    public Task<ShopPaymentResult> ChargeAsync(ShopPaymentRequest request, CancellationToken ct = default)
    {
        logger.LogInformation("DevelopmentShopPaymentGateway charge {Method} {Amount} {Currency} (key {Key}). No real charge is made.",
            request.Method, request.Amount, request.Currency, request.IdempotencyKey);
        return inner.ChargeAsync(request, ct);
    }

    public Task<ShopPaymentResult> RefundAsync(ShopPayment payment, CancellationToken ct = default)
    {
        logger.LogInformation("DevelopmentShopPaymentGateway refund for order {OrderId}. No real refund is made.", payment.OrderId);
        return inner.RefundAsync(payment, ct);
    }
}
