using GymManagmentApplication.Infrastructure.Data;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace GymManagmentApplication.Infrastructure.Http;

/// <summary>
/// Readiness: can the API reach its database? Used by /healthz/ready only — the liveness probe
/// (/healthz, Render's healthCheckPath) deliberately doesn't touch the database, so a short
/// Supabase hiccup doesn't make Render restart a healthy process.
/// </summary>
public class DatabaseHealthCheck(AppDbContext db) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        try
        {
            return await db.Database.CanConnectAsync(cancellationToken)
                ? HealthCheckResult.Healthy()
                : HealthCheckResult.Unhealthy("Database unreachable.");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("Database unreachable.", ex);
        }
    }
}
