using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Common;

/// <summary>
/// "Today" / "this month" in the gym's own time zone (Tenant.Timezone, an IANA id such as
/// "Asia/Kolkata"), as UTC instants for querying UTC timestamps. Falls back to UTC.
/// </summary>
public sealed class TenantClock
{
    public TimeZoneInfo Zone { get; }

    private TenantClock(TimeZoneInfo zone) => Zone = zone;

    public static async Task<TenantClock> ForAsync(AppDbContext db, ulong? tenantId)
    {
        var id = tenantId is null ? null
            : await db.Tenants.IgnoreQueryFilters().Where(t => t.Id == tenantId).Select(t => t.Timezone).FirstOrDefaultAsync();
        return new TenantClock(Resolve(id));
    }

    public static TimeZoneInfo Resolve(string? id)
    {
        if (string.IsNullOrWhiteSpace(id)) return TimeZoneInfo.Utc;
        try { return TimeZoneInfo.FindSystemTimeZoneById(id); }
        catch (Exception) { return TimeZoneInfo.Utc; }
    }

    public DateTime LocalNow => TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, Zone);

    public DateOnly Today => DateOnly.FromDateTime(LocalNow);

    /// <summary>UTC instant at which the given local date starts.</summary>
    public DateTime StartOfDayUtc(DateOnly localDate) =>
        TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(localDate.ToDateTime(TimeOnly.MinValue), DateTimeKind.Unspecified), Zone);

    public DateTime StartOfTodayUtc => StartOfDayUtc(Today);

    public DateTime StartOfMonthUtc(int monthsBack = 0)
    {
        var first = new DateOnly(Today.Year, Today.Month, 1).AddMonths(-monthsBack);
        return StartOfDayUtc(first);
    }
}
