using GymManagmentApplication.Domain.Enums;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Common;

/// <summary>Whether a member's memberships let them use the gym (check in, book classes).</summary>
public static class MembershipRules
{
    /// <summary>
    /// Why the member may not use the gym on <paramref name="day"/>, or null if they may.
    /// Members whose memberships have all expired, been cancelled or are frozen are refused.
    /// Members with no membership record at all are allowed (gyms that don't track
    /// memberships in the app yet).
    /// </summary>
    public static async Task<string?> BlockReasonAsync(AppDbContext db, ulong userId, DateOnly? day = null)
    {
        var today = day ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var memberships = await db.GymMemberships.IgnoreQueryFilters()
            .Where(m => m.UserId == userId)
            .Select(m => new { m.Status, m.StartsAt, m.EndsAt })
            .ToListAsync();
        if (memberships.Count == 0) return null;

        if (memberships.Any(m => (m.Status == MembershipStatus.Active || m.Status == MembershipStatus.Trial)
                                 && m.StartsAt <= today && (m.EndsAt is null || m.EndsAt >= today)))
            return null;
        if (memberships.Any(m => m.Status == MembershipStatus.Paused))
            return "Your membership is frozen. Ask the front desk to unfreeze it.";
        if (memberships.Any(m => (m.Status == MembershipStatus.Active || m.Status == MembershipStatus.Trial) && m.StartsAt > today))
            return "Your membership hasn't started yet.";
        return "Your membership has expired. Please renew it.";
    }
}
