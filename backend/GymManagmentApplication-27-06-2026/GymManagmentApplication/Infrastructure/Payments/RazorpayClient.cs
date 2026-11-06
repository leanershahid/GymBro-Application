using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using GymManagmentApplication.Application.Billing.Payments;

namespace GymManagmentApplication.Infrastructure.Payments;

/// <summary>Minimal Razorpay REST client: orders, payment lookup, refunds, signature check.</summary>
public class RazorpayClient(IHttpClientFactory httpFactory, ILogger<RazorpayClient> logger) : IRazorpayClient
{
    private const string Api = "https://api.razorpay.com/v1";

    public static long ToMinor(decimal amount) => RazorpayApi.ToMinor(amount);

    public async Task<RazorpayOrder> CreateOrderAsync(RazorpayKeys keys, decimal amount, string currency, string receipt, IDictionary<string, string> notes)
    {
        var body = await SendAsync(keys, HttpMethod.Post, "/orders", new
        {
            amount = ToMinor(amount), currency, receipt, notes,
        });
        return new RazorpayOrder(body.GetProperty("id").GetString()!, body.GetProperty("amount").GetInt64(), body.GetProperty("currency").GetString()!);
    }

    public async Task<RazorpayPaymentInfo> GetPaymentAsync(RazorpayKeys keys, string paymentId)
    {
        var body = await SendAsync(keys, HttpMethod.Get, $"/payments/{Uri.EscapeDataString(paymentId)}", null);
        return ReadPayment(body);
    }

    /// <param name="receipt">Our own reference for the refund (shown in the Razorpay dashboard).</param>
    public async Task<string> RefundAsync(RazorpayKeys keys, string paymentId, decimal amount, string? receipt = null)
    {
        object payload = receipt is null ? new { amount = ToMinor(amount) } : new { amount = ToMinor(amount), receipt };
        var body = await SendAsync(keys, HttpMethod.Post, $"/payments/{Uri.EscapeDataString(paymentId)}/refund", payload);
        return body.GetProperty("id").GetString()!;
    }

    /// <summary>Captures an "authorized" payment (amount must equal the authorised amount).</summary>
    public async Task<RazorpayPaymentInfo> CaptureAsync(RazorpayKeys keys, string paymentId, long amountMinor, string currency)
    {
        var body = await SendAsync(keys, HttpMethod.Post, $"/payments/{Uri.EscapeDataString(paymentId)}/capture",
            new { amount = amountMinor, currency });
        return ReadPayment(body);
    }

    /// <summary>The notes we attached when creating the order (invoiceId, tenantId).</summary>
    public async Task<IReadOnlyDictionary<string, string>> GetOrderNotesAsync(RazorpayKeys keys, string orderId)
    {
        var body = await SendAsync(keys, HttpMethod.Get, $"/orders/{Uri.EscapeDataString(orderId)}", null);
        return ReadNotes(body);
    }

    public static RazorpayPaymentInfo ReadPayment(JsonElement body) => RazorpayApi.ReadPayment(body);
    public static IReadOnlyDictionary<string, string> ReadNotes(JsonElement entity) => RazorpayApi.ReadNotes(entity);
    public static bool VerifyWebhookSignature(string webhookSecret, string rawBody, string? signature) =>
        RazorpayApi.VerifyWebhookSignature(webhookSecret, rawBody, signature);
    public static bool VerifySignature(RazorpayKeys keys, string orderId, string paymentId, string signature) =>
        RazorpayApi.VerifySignature(keys, orderId, paymentId, signature);

    /// <summary>Validates keys by listing one order (cheap, read-only).</summary>
    public async Task<bool> TestKeysAsync(RazorpayKeys keys)
    {
        try { await SendAsync(keys, HttpMethod.Get, "/orders?count=1", null); return true; }
        catch (Exception) { return false; }
    }

    /// <summary>The path without ids (payment/order ids are kept out of logs).</summary>
    private static string LogPath(string path) =>
        System.Text.RegularExpressions.Regex.Replace(path.Split('?')[0], "/(pay|order|rfnd)_[A-Za-z0-9]+", "/{id}");

    private async Task<JsonElement> SendAsync(RazorpayKeys keys, HttpMethod method, string path, object? payload)
    {
        using var req = new HttpRequestMessage(method, Api + path);
        req.Headers.Authorization = new AuthenticationHeaderValue("Basic",
            Convert.ToBase64String(Encoding.UTF8.GetBytes($"{keys.KeyId}:{keys.KeySecret}")));
        if (payload is not null) req.Content = JsonContent.Create(payload);

        HttpResponseMessage res;
        try { res = await httpFactory.CreateClient().SendAsync(req); }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            logger.LogWarning("Razorpay {Method} {Path} could not be reached: {Error}", method, LogPath(path), ex.GetType().Name);
            throw new HttpRequestException("The payment provider could not be reached. Please try again.", ex);
        }
        using var _ = res;
        var text = await res.Content.ReadAsStringAsync();
        if (!res.IsSuccessStatusCode)
        {
            // ARCH-048: never log the response body (it can carry customer contact details).
            string? code = null, description = null;
            try
            {
                var error = JsonDocument.Parse(text).RootElement.GetProperty("error");
                code = error.TryGetProperty("code", out var c) ? c.GetString() : null;
                description = error.TryGetProperty("description", out var d) ? d.GetString() : null;
            }
            catch (Exception) { /* not a Razorpay error body */ }
            logger.LogWarning("Razorpay {Method} {Path} failed ({Status}, {Code}).", method, LogPath(path), (int)res.StatusCode, code ?? "-");
            // ARCH-095: provider outages are upstream failures (502); rejections are the caller's (400).
            if ((int)res.StatusCode >= 500)
                throw new HttpRequestException("The payment provider is having trouble. Please try again shortly.");
            throw new ArgumentException(description ?? "The payment provider rejected the request.");
        }
        return JsonDocument.Parse(text).RootElement.Clone();
    }
}
