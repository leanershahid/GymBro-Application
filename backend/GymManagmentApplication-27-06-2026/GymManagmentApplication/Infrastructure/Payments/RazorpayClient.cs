using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace GymManagmentApplication.Infrastructure.Payments;

/// <summary>A gym's Razorpay API keys (stored encrypted in PaymentGateways).</summary>
public record RazorpayKeys(string KeyId, string KeySecret);

/// <summary>Minimal Razorpay REST client: orders, payment lookup, refunds, signature check.</summary>
public class RazorpayClient(IHttpClientFactory httpFactory, ILogger<RazorpayClient> logger)
{
    private const string Api = "https://api.razorpay.com/v1";

    public record Order(string Id, long AmountMinor, string Currency);
    public record PaymentInfo(string Id, string Status, string Method, long AmountMinor, string? OrderId);

    /// <summary>Amount in the currency's minor unit (paise for INR).</summary>
    public static long ToMinor(decimal amount) => (long)Math.Round(amount * 100m, MidpointRounding.AwayFromZero);

    public async Task<Order> CreateOrderAsync(RazorpayKeys keys, decimal amount, string currency, string receipt, IDictionary<string, string> notes)
    {
        var body = await SendAsync(keys, HttpMethod.Post, "/orders", new
        {
            amount = ToMinor(amount), currency, receipt, notes,
        });
        return new Order(body.GetProperty("id").GetString()!, body.GetProperty("amount").GetInt64(), body.GetProperty("currency").GetString()!);
    }

    public async Task<PaymentInfo> GetPaymentAsync(RazorpayKeys keys, string paymentId)
    {
        var body = await SendAsync(keys, HttpMethod.Get, $"/payments/{Uri.EscapeDataString(paymentId)}", null);
        return new PaymentInfo(
            body.GetProperty("id").GetString()!,
            body.GetProperty("status").GetString() ?? "",
            body.TryGetProperty("method", out var m) ? m.GetString() ?? "" : "",
            body.GetProperty("amount").GetInt64(),
            body.TryGetProperty("order_id", out var o) ? o.GetString() : null);
    }

    public async Task<string> RefundAsync(RazorpayKeys keys, string paymentId, decimal amount)
    {
        var body = await SendAsync(keys, HttpMethod.Post, $"/payments/{Uri.EscapeDataString(paymentId)}/refund", new { amount = ToMinor(amount) });
        return body.GetProperty("id").GetString()!;
    }

    /// <summary>Checks the signature Razorpay Checkout returns: HMAC-SHA256(order_id|payment_id, key_secret).</summary>
    public static bool VerifySignature(RazorpayKeys keys, string orderId, string paymentId, string signature)
    {
        var expected = HMACSHA256.HashData(Encoding.UTF8.GetBytes(keys.KeySecret), Encoding.UTF8.GetBytes($"{orderId}|{paymentId}"));
        var actual = Encoding.UTF8.GetBytes(signature ?? "");
        var expectedHex = Encoding.UTF8.GetBytes(Convert.ToHexString(expected).ToLowerInvariant());
        return CryptographicOperations.FixedTimeEquals(expectedHex, actual);
    }

    /// <summary>Validates keys by listing one order (cheap, read-only).</summary>
    public async Task<bool> TestKeysAsync(RazorpayKeys keys)
    {
        try { await SendAsync(keys, HttpMethod.Get, "/orders?count=1", null); return true; }
        catch (Exception) { return false; }
    }

    private async Task<JsonElement> SendAsync(RazorpayKeys keys, HttpMethod method, string path, object? payload)
    {
        using var req = new HttpRequestMessage(method, Api + path);
        req.Headers.Authorization = new AuthenticationHeaderValue("Basic",
            Convert.ToBase64String(Encoding.UTF8.GetBytes($"{keys.KeyId}:{keys.KeySecret}")));
        if (payload is not null) req.Content = JsonContent.Create(payload);

        var res = await httpFactory.CreateClient().SendAsync(req);
        var text = await res.Content.ReadAsStringAsync();
        if (!res.IsSuccessStatusCode)
        {
            logger.LogWarning("Razorpay {Method} {Path} failed ({Status}): {Body}", method, path, (int)res.StatusCode, text);
            string? description = null;
            try { description = JsonDocument.Parse(text).RootElement.GetProperty("error").GetProperty("description").GetString(); }
            catch (Exception) { /* not a Razorpay error body */ }
            throw new ArgumentException(description ?? "The payment provider rejected the request.");
        }
        return JsonDocument.Parse(text).RootElement.Clone();
    }
}
