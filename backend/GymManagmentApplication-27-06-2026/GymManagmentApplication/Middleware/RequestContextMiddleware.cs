using System.Diagnostics;
using System.Security.Claims;

namespace GymManagmentApplication.Middleware;

/// <summary>
/// Per-request correlation and access log:
/// <list type="bullet">
/// <item>Echoes the trace id as <c>X-Trace-Id</c> (also in every error body), so a user report can be
/// matched to the log line.</item>
/// <item>Adds <c>api-version</c> to every response. The API is unversioned today (routes stay
/// <c>/api/...</c>); this header is the contract version. A breaking change ships as
/// <c>/api/v2/...</c> next to the old routes, and installed mobile apps keep using v1.</item>
/// <item>Logs one line per request — method, path (no query string, which can carry personal data),
/// status, duration, user id and tenant id — inside a logging scope carrying the trace id, so every log
/// line written while handling the request carries it too.</item>
/// </list>
/// </summary>
public class RequestContextMiddleware(RequestDelegate next, ILogger<RequestContextMiddleware> logger)
{
    public const string ApiVersion = "1";

    public async Task InvokeAsync(HttpContext context)
    {
        var traceId = Activity.Current?.TraceId.ToString() ?? context.TraceIdentifier;
        context.TraceIdentifier = traceId;
        context.Response.OnStarting(() =>
        {
            context.Response.Headers["X-Trace-Id"] = traceId;
            context.Response.Headers["api-version"] = ApiVersion;
            return Task.CompletedTask;
        });

        // Health probes would drown out everything else.
        if (context.Request.Path.StartsWithSegments("/healthz"))
        {
            await next(context);
            return;
        }

        using var scope = logger.BeginScope(new Dictionary<string, object> { ["TraceId"] = traceId });
        var started = Stopwatch.GetTimestamp();
        try
        {
            await next(context);
        }
        finally
        {
            var elapsed = Stopwatch.GetElapsedTime(started).TotalMilliseconds;
            var status = context.Response.StatusCode;
            var level = status >= 500 ? LogLevel.Error : status >= 400 ? LogLevel.Warning : LogLevel.Information;
            logger.Log(level, "HTTP {Method} {Path} -> {Status} in {Elapsed:0} ms (user {UserId}, tenant {TenantId})",
                context.Request.Method, context.Request.Path.Value, status, elapsed,
                context.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "-",
                context.User.FindFirstValue(Application.Common.CustomClaims.TenantId) ?? "-");
        }
    }
}
