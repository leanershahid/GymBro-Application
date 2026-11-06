using GymManagmentApplication.Application.Common;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Common;

/// <summary>Race-safe per-gym running numbers backed by the TenantCounters table.</summary>
public static class TenantCounters
{
    /// <summary>
    /// Returns the next number for (<paramref name="tenantId"/>, <paramref name="key"/>) — never
    /// below <paramref name="floor"/>, which lets the first call continue from numbers already
    /// issued before the counter existed. The row stays locked until the surrounding transaction
    /// ends (or the statement commits on its own), so concurrent callers are serialised; a rolled
    /// back caller leaves no gap, a failed save after an auto-commit leaves one (harmless).
    /// </summary>
    public static async Task<long> NextAsync(IAppDbContext db, ulong tenantId, string key, long floor = 1, CancellationToken ct = default)
    {
        var tenant = (decimal)tenantId;
        var rows = await db.Database.SqlQuery<long>($"""
            INSERT INTO "TenantCounters" ("TenantId", "Key", "Value", "UpdatedAt")
            VALUES ({tenant}, {key}, {floor}, now())
            ON CONFLICT ("TenantId", "Key")
            DO UPDATE SET "Value" = GREATEST("TenantCounters"."Value" + 1, EXCLUDED."Value"), "UpdatedAt" = now()
            RETURNING "Value" AS "Value"
            """).ToListAsync(ct);
        return rows[0];
    }
}
