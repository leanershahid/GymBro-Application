using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace GymManagmentApplication.Application.Billing.Payments;

/// <summary>A gym's Razorpay API keys (stored encrypted in PaymentGateways).</summary>
public record RazorpayKeys(string KeyId, string KeySecret);

public record RazorpayOrder(string Id, long AmountMinor, string Currency);

public record RazorpayPaymentInfo(string Id, string Status, string Method, long AmountMinor, string? OrderId);

/// <summary>
/// Razorpay REST calls the billing services need (ARCH-022). Implemented over HTTP by
/// <c>Infrastructure.Payments.RazorpayClient</c>.
/// </summary>
public interface IRazorpayClient
{
    Task<RazorpayOrder> CreateOrderAsync(RazorpayKeys keys, decimal amount, string currency, string receipt, IDictionary<string, string> notes);
    Task<RazorpayPaymentInfo> GetPaymentAsync(RazorpayKeys keys, string paymentId);
    /// <param name="receipt">Our own reference for the refund (shown in the Razorpay dashboard).</param>
    Task<string> RefundAsync(RazorpayKeys keys, string paymentId, decimal amount, string? receipt = null);
    /// <summary>Captures an "authorized" payment (amount must equal the authorised amount).</summary>
    Task<RazorpayPaymentInfo> CaptureAsync(RazorpayKeys keys, string paymentId, long amountMinor, string currency);
    /// <summary>The notes we attached when creating the order (invoiceId, tenantId).</summary>
    Task<IReadOnlyDictionary<string, string>> GetOrderNotesAsync(RazorpayKeys keys, string orderId);
    /// <summary>Validates keys by listing one order (cheap, read-only).</summary>
    Task<bool> TestKeysAsync(RazorpayKeys keys);
}

/// <summary>Pure Razorpay helpers: amounts, payload parsing and signature checks (no I/O).</summary>
public static class RazorpayApi
{
    /// <summary>Amount in the currency's minor unit (paise for INR).</summary>
    public static long ToMinor(decimal amount) => (long)Math.Round(amount * 100m, MidpointRounding.AwayFromZero);

    public static RazorpayPaymentInfo ReadPayment(JsonElement body) => new(
        body.GetProperty("id").GetString()!,
        body.GetProperty("status").GetString() ?? "",
        body.TryGetProperty("method", out var m) ? m.GetString() ?? "" : "",
        body.GetProperty("amount").GetInt64(),
        body.TryGetProperty("order_id", out var o) && o.ValueKind == JsonValueKind.String ? o.GetString() : null);

    public static IReadOnlyDictionary<string, string> ReadNotes(JsonElement entity)
    {
        var notes = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        if (entity.TryGetProperty("notes", out var n) && n.ValueKind == JsonValueKind.Object)
            foreach (var p in n.EnumerateObject())
                notes[p.Name] = p.Value.ValueKind == JsonValueKind.String ? p.Value.GetString() ?? "" : p.Value.ToString();
        return notes;
    }

    /// <summary>Checks a webhook: X-Razorpay-Signature = hex HMAC-SHA256(raw body, webhook secret).</summary>
    public static bool VerifyWebhookSignature(string webhookSecret, string rawBody, string? signature)
    {
        if (string.IsNullOrEmpty(webhookSecret) || string.IsNullOrEmpty(signature)) return false;
        var expected = HMACSHA256.HashData(Encoding.UTF8.GetBytes(webhookSecret), Encoding.UTF8.GetBytes(rawBody));
        var expectedHex = Encoding.UTF8.GetBytes(Convert.ToHexString(expected).ToLowerInvariant());
        return CryptographicOperations.FixedTimeEquals(expectedHex, Encoding.UTF8.GetBytes(signature.Trim().ToLowerInvariant()));
    }

    /// <summary>Checks the signature Razorpay Checkout returns: HMAC-SHA256(order_id|payment_id, key_secret).</summary>
    public static bool VerifySignature(RazorpayKeys keys, string orderId, string paymentId, string signature)
    {
        var expected = HMACSHA256.HashData(Encoding.UTF8.GetBytes(keys.KeySecret), Encoding.UTF8.GetBytes($"{orderId}|{paymentId}"));
        var actual = Encoding.UTF8.GetBytes(signature ?? "");
        var expectedHex = Encoding.UTF8.GetBytes(Convert.ToHexString(expected).ToLowerInvariant());
        return CryptographicOperations.FixedTimeEquals(expectedHex, actual);
    }
}
