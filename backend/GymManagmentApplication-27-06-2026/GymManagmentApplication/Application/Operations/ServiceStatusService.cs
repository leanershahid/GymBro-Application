using System.Linq.Expressions;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Domain.Entities.Operations;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Operations;

/// <summary>
/// Service status notices ("Pool closed for maintenance", "Cardio floor limited"). A notice shows
/// from StartsAt until EndsAt and then simply stops showing: expiry is part of every query, so
/// nothing has to run for it to disappear.
/// </summary>
public class ServiceStatusService(IAppDbContext db, ICurrentUser currentUser)
{
    /// <summary>Showing at <paramref name="nowUtc"/>.</summary>
    public static Expression<Func<ServiceStatus, bool>> ActiveAt(DateTime nowUtc) =>
        s => s.StartsAt <= nowUtc && (s.EndsAt == null || s.EndsAt > nowUtc);

    /// <summary>Same rule as <see cref="ActiveAt"/>, in memory.</summary>
    public static bool IsActive(ServiceStatus s, DateTime nowUtc) => s.StartsAt <= nowUtc && (s.EndsAt == null || s.EndsAt > nowUtc);

    /// <summary>
    /// What members see for a branch: its own notices plus gym-wide ones, worst first. Without a
    /// branch: every active notice of the gym.
    /// </summary>
    public async Task<List<ServiceStatusDto>> GetActiveAsync(ulong? branchId, DateTime? nowUtc = null)
    {
        var now = nowUtc ?? DateTime.UtcNow;
        var q = db.ServiceStatuses.Where(ActiveAt(now));
        if (branchId is { } b) q = q.Where(s => s.BranchId == null || s.BranchId == b);
        var rows = await q.ToListAsync();
        var names = await BranchNamesAsync(rows);
        return rows
            .OrderByDescending(s => s.Severity).ThenByDescending(s => s.Status).ThenByDescending(s => s.StartsAt)
            .Select(s => Map(s, names, now)).ToList();
    }

    /// <summary>Admin list: current and upcoming notices, plus (optionally) those ended in the last 30 days.</summary>
    public async Task<List<ServiceStatusDto>> ListAsync(bool includeEnded)
    {
        var now = DateTime.UtcNow;
        var since = now.AddDays(-30);
        var rows = await db.ServiceStatuses
            .Where(s => s.EndsAt == null || s.EndsAt > now || (includeEnded && s.EndsAt > since))
            .OrderByDescending(s => s.StartsAt).Take(200).ToListAsync();
        var names = await BranchNamesAsync(rows);
        return rows.Select(s => Map(s, names, now)).ToList();
    }

    public async Task<ServiceStatusDto> CreateAsync(ServiceStatusRequest request)
    {
        var row = new ServiceStatus { TenantId = currentUser.ResolveTenantId(), CreatedByUserId = currentUser.UserId };
        await ApplyAsync(row, request);
        db.ServiceStatuses.Add(row);
        await db.SaveChangesAsync();
        return Map(row, await BranchNamesAsync([row]), DateTime.UtcNow);
    }

    public async Task<ServiceStatusDto> UpdateAsync(ulong id, ServiceStatusRequest request)
    {
        var row = await db.ServiceStatuses.FirstOrDefaultAsync(s => s.Id == id) ?? throw new KeyNotFoundException("Status not found.");
        await ApplyAsync(row, request);
        await db.SaveChangesAsync();
        return Map(row, await BranchNamesAsync([row]), DateTime.UtcNow);
    }

    /// <summary>Ends a notice now (kept for history).</summary>
    public async Task<ServiceStatusDto> EndAsync(ulong id)
    {
        var row = await db.ServiceStatuses.FirstOrDefaultAsync(s => s.Id == id) ?? throw new KeyNotFoundException("Status not found.");
        var now = DateTime.UtcNow;
        if (row.EndsAt is null || row.EndsAt > now) row.EndsAt = now;
        if (row.StartsAt > now) row.StartsAt = now;
        await db.SaveChangesAsync();
        return Map(row, await BranchNamesAsync([row]), now);
    }

    public async Task<bool> DeleteAsync(ulong id)
    {
        var row = await db.ServiceStatuses.FirstOrDefaultAsync(s => s.Id == id);
        if (row is null) return false;
        db.ServiceStatuses.Remove(row);
        await db.SaveChangesAsync();
        return true;
    }

    private async Task ApplyAsync(ServiceStatus row, ServiceStatusRequest r)
    {
        if (string.IsNullOrWhiteSpace(r.Message)) throw new ArgumentException("Write a short message for members.");
        if (r.Message.Trim().Length > 500) throw new ArgumentException("The message can be at most 500 characters.");
        if (!Enum.TryParse<ServiceStatusLevel>(r.Status, true, out var level))
            throw new ArgumentException("Status must be Normal, Limited or Closed.");
        if (!Enum.TryParse<ServiceStatusSeverity>(r.Severity, true, out var severity))
            throw new ArgumentException("Severity must be Info, Warning or Critical.");
        var starts = r.StartsAt is { } s ? DateTime.SpecifyKind(s, DateTimeKind.Utc) : row.Id == 0 ? DateTime.UtcNow : row.StartsAt;
        DateTime? ends = r.EndsAt is { } e ? DateTime.SpecifyKind(e, DateTimeKind.Utc) : null;
        if (ends is { } end && end <= starts) throw new ArgumentException("The end must be after the start.");
        if (r.BranchId is { } b && !await db.Branches.AnyAsync(x => x.Id == b)) throw new ArgumentException("Branch not found.");
        var area = string.IsNullOrWhiteSpace(r.Area) ? null : r.Area.Trim();
        if (area is { Length: > 80 }) throw new ArgumentException("The area name can be at most 80 characters.");

        row.BranchId = r.BranchId;
        row.Area = area;
        row.Status = level;
        row.Severity = severity;
        row.Message = r.Message.Trim();
        row.StartsAt = starts;
        row.EndsAt = ends;
    }

    private async Task<Dictionary<ulong, string>> BranchNamesAsync(IEnumerable<ServiceStatus> rows)
    {
        var ids = rows.Where(r => r.BranchId != null).Select(r => r.BranchId!.Value).Distinct().ToList();
        if (ids.Count == 0) return [];
        return await db.Branches.Where(b => ids.Contains(b.Id)).ToDictionaryAsync(b => b.Id, b => b.Name);
    }

    private static ServiceStatusDto Map(ServiceStatus s, Dictionary<ulong, string> names, DateTime now)
    {
        var branchName = s.BranchId is { } b && names.TryGetValue(b, out var n) ? n : null;
        var subject = s.Area ?? branchName ?? "Gym";
        return new ServiceStatusDto
        {
            Id = s.Id, BranchId = s.BranchId, BranchName = branchName, Area = s.Area,
            Status = s.Status.ToString(), Severity = s.Severity.ToString(), Message = s.Message,
            StartsAt = s.StartsAt, EndsAt = s.EndsAt, IsActive = IsActive(s, now),
            Headline = $"{subject} · {s.Status switch { ServiceStatusLevel.Closed => "Closed", ServiceStatusLevel.Limited => "Limited", _ => "Back to normal" }}",
        };
    }
}
