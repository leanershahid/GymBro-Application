using System.Security.Cryptography;
using GymManagmentApplication.Domain.Entities.Shop;

namespace GymManagmentApplication.Application.Shop.Orders;

public sealed record ShopPaymentRequest(ulong OrderId, ShopPaymentMethod Method, decimal Amount, string Currency);

public sealed record ShopPaymentResult(ShopPaymentStatus Status, string? TransactionReference, DateTime? PaidAt, string? FailureReason);

/// <summary>
/// The shop's payment provider. Replace <see cref="DevelopmentShopPaymentGateway"/> with a real one
/// (e.g. Razorpay) by changing its registration in <see cref="ShopOrdersRegistration"/>.
/// </summary>
public interface IShopPaymentGateway
{
    Task<ShopPaymentResult> ChargeAsync(ShopPaymentRequest request, CancellationToken ct = default);
    Task<ShopPaymentResult> RefundAsync(ShopPayment payment, CancellationToken ct = default);
}

/// <summary>
/// DEVELOPMENT STUB — moves no money. Cash on delivery → Pending (collected on delivery);
/// Card / UPI → Paid at once with a fake "DEV-xxxx" reference; refunds → Refunded.
/// </summary>
public sealed class DevelopmentShopPaymentGateway(ILogger<DevelopmentShopPaymentGateway> logger) : IShopPaymentGateway
{
    public Task<ShopPaymentResult> ChargeAsync(ShopPaymentRequest request, CancellationToken ct = default)
    {
        if (request.Method == ShopPaymentMethod.CashOnDelivery)
            return Task.FromResult(new ShopPaymentResult(ShopPaymentStatus.Pending, null, null, null));

        var reference = "DEV-" + Convert.ToHexString(RandomNumberGenerator.GetBytes(6));
        logger.LogWarning("DevelopmentShopPaymentGateway approved {Method} payment of {Amount} {Currency} ({Reference}). No real charge was made.",
            request.Method, request.Amount, request.Currency, reference);
        return Task.FromResult(new ShopPaymentResult(ShopPaymentStatus.Paid, reference, DateTime.UtcNow, null));
    }

    public Task<ShopPaymentResult> RefundAsync(ShopPayment payment, CancellationToken ct = default)
    {
        logger.LogWarning("DevelopmentShopPaymentGateway refunded payment {Reference}. No real refund was made.", payment.TransactionReference);
        return Task.FromResult(new ShopPaymentResult(ShopPaymentStatus.Refunded, payment.TransactionReference, payment.PaidAt, null));
    }
}
