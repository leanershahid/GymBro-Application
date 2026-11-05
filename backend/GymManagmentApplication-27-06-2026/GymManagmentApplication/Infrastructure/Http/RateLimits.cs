using System.Security.Claims;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

namespace GymManagmentApplication.Infrastructure.Http;

/// <summary>
/// Rate-limit policies. Partitioned by client IP — the real one: behind Render's proxy the forwarded
/// headers middleware (Program.cs, ForwardLimit = 1) takes the address the proxy itself appended to
/// X-Forwarded-For, so values a client puts in that header are ignored.
/// <list type="bullet">
/// <item><see cref="Auth"/>: sign-in, refresh, reset and OTP endpoints — 20/min per IP.</item>
/// <item><see cref="Uploads"/>: file uploads — 30/min per signed-in user (IP when anonymous).</item>
/// <item>Global (optional): "RateLimits:GlobalPerMinute" per IP for every request; 0/absent = off,
/// since a whole gym's members can share one Wi-Fi address.</item>
/// </list>
/// </summary>
public static class RateLimits
{
    public const string Auth = "auth";
    public const string Uploads = "uploads";

    private static string ClientIp(HttpContext http) => http.Connection.RemoteIpAddress?.ToString() ?? "unknown";

    public static IServiceCollection AddAppRateLimits(this IServiceCollection services, IConfiguration config) =>
        services.AddRateLimiter(o =>
        {
            o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            o.OnRejected = async (ctx, ct) =>
            {
                ctx.HttpContext.Response.ContentType = "application/json";
                await ctx.HttpContext.Response.WriteAsync(System.Text.Json.JsonSerializer.Serialize(
                    GymManagmentApplication.Middleware.ErrorResponse.Create(ctx.HttpContext, "Too many attempts. Please wait a minute and try again."),
                    GymManagmentApplication.Middleware.ErrorResponse.Json), ct);
            };

            o.AddPolicy(Auth, http => RateLimitPartition.GetFixedWindowLimiter(
                ClientIp(http),
                _ => new FixedWindowRateLimiterOptions { PermitLimit = 20, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));

            o.AddPolicy(Uploads, http => RateLimitPartition.GetFixedWindowLimiter(
                http.User.FindFirstValue(ClaimTypes.NameIdentifier) is { } userId ? $"user:{userId}" : $"ip:{ClientIp(http)}",
                _ => new FixedWindowRateLimiterOptions { PermitLimit = 30, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));

            var globalPerMinute = config.GetValue<int>("RateLimits:GlobalPerMinute");
            if (globalPerMinute > 0)
                o.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(http =>
                    http.Request.Path.StartsWithSegments("/healthz")
                        ? RateLimitPartition.GetNoLimiter("health")
                        : RateLimitPartition.GetFixedWindowLimiter(ClientIp(http),
                            _ => new FixedWindowRateLimiterOptions { PermitLimit = globalPerMinute, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
        });
}
