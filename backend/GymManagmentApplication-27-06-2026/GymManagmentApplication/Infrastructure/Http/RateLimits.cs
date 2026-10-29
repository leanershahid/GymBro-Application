using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

namespace GymManagmentApplication.Infrastructure.Http;

/// <summary>Rate-limit policies. Partitioned by client IP (real IP via forwarded headers behind Render's proxy).</summary>
public static class RateLimits
{
    public const string Auth = "auth";

    public static IServiceCollection AddAppRateLimits(this IServiceCollection services) =>
        services.AddRateLimiter(o =>
        {
            o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            o.OnRejected = async (ctx, ct) =>
            {
                ctx.HttpContext.Response.ContentType = "application/json";
                await ctx.HttpContext.Response.WriteAsync(
                    System.Text.Json.JsonSerializer.Serialize(GymManagmentApplication.Application.Common.ApiResponse<object>.Fail("Too many attempts. Please wait a minute and try again.")), ct);
            };
            // Sign-in, refresh, reset and OTP endpoints: 20 requests per minute per IP.
            o.AddPolicy(Auth, http => RateLimitPartition.GetFixedWindowLimiter(
                http.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                _ => new FixedWindowRateLimiterOptions { PermitLimit = 20, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
        });
}
