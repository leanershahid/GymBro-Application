using GymManagmentApplication.Domain.Constants;
using GymManagmentApplication.Domain.Entities.Identity;
using GymManagmentApplication.Domain.Enums;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Common;

/// <summary>
/// Who may act on which person, on top of the tenant query filter:
/// <list type="bullet">
///   <item>client — only themselves</item>
///   <item>trainer — only clients currently assigned to them</item>
///   <item>admin / staff / custom roles — anyone in their gym, except super admin accounts</item>
///   <item>super admin — anyone</item>
/// </list>
/// </summary>
public static class MemberScope
{
    public static bool IsClient(this ICurrentUser u) =>
        u.Role.Equals(RoleNames.Client, StringComparison.OrdinalIgnoreCase);

    public static bool IsTrainer(this ICurrentUser u) =>
        u.Role.Equals(RoleNames.Trainer, StringComparison.OrdinalIgnoreCase);

    /// <summary>Ids of the clients actively assigned to the calling trainer.</summary>
    public static IQueryable<ulong> AssignedClientIds(this AppDbContext db, ulong trainerUserId) =>
        from a in db.TrainerClientAssignments
        join t in db.TrainerProfiles on a.TrainerId equals t.Id
        where t.UserId == trainerUserId && a.Status == TrainerAssignmentStatus.Active
        select a.ClientId;

    /// <summary>True when the caller may read/act on <paramref name="targetUserId"/>.</summary>
    public static async Task<bool> CanActOnAsync(this AppDbContext db, ICurrentUser me, ulong targetUserId)
    {
        if (me.IsClient()) return me.UserId == targetUserId;
        if (me.IsTrainer())
            return me.UserId == targetUserId ||
                   await db.AssignedClientIds(me.UserId ?? 0).AnyAsync(id => id == targetUserId);
        return true; // admin / delegated — the tenant filter already confines them to their gym
    }

    /// <summary>Throws (→ 403) unless the caller may act on every id (see <see cref="CanActOnAsync"/>).</summary>
    public static async Task EnsureCanActOnAllAsync(this AppDbContext db, ICurrentUser me, IEnumerable<ulong> userIds)
    {
        foreach (var id in userIds)
            if (!await db.CanActOnAsync(me, id))
                throw new UnauthorizedAccessException(me.IsTrainer()
                    ? $"Member {id} is not assigned to you."
                    : "You can only access your own records.");
    }

    /// <summary>
    /// The TrainerProfile id to record on an assignment. A trainer always records themselves;
    /// admins/staff may name any trainer of their gym (tenant-filtered) or none.
    /// </summary>
    public static async Task<ulong?> ResolveAssigningTrainerAsync(this AppDbContext db, ICurrentUser me, ulong? requestedTrainerId)
    {
        if (me.IsTrainer())
            return await db.TrainerProfiles.Where(t => t.UserId == me.UserId).Select(t => (ulong?)t.Id).FirstOrDefaultAsync()
                   ?? throw new UnauthorizedAccessException("This account has no trainer profile.");
        if (requestedTrainerId is not { } id || id == 0) return null;
        return await db.TrainerProfiles.AnyAsync(t => t.Id == id)
            ? id
            : throw new ArgumentException($"Trainer {id} not found in this gym.");
    }

    /// <summary>
    /// Loads a person the caller may act on, or throws 403. Returns null when the user doesn't
    /// exist in the caller's gym. Super admin accounts are only reachable by a super admin.
    /// </summary>
    public static async Task<User?> GetActionableUserAsync(this AppDbContext db, ICurrentUser me, ulong targetUserId)
    {
        var user = await db.Users.Include(u => u.Branch)
            .FirstOrDefaultAsync(u => u.Id == targetUserId && u.DeletedAt == null);
        if (user is null) return null;

        if (!me.IsSuperAdmin)
        {
            var slug = await db.Roles.IgnoreQueryFilters()
                .Where(r => r.Id == user.RoleId).Select(r => r.Slug).FirstOrDefaultAsync();
            if (slug == RoleNames.SuperAdmin) return null; // invisible to everyone else
        }

        if (!await db.CanActOnAsync(me, targetUserId))
            throw new UnauthorizedAccessException(me.IsTrainer()
                ? "You can only access members assigned to you."
                : "You can only access your own profile.");
        return user;
    }
}
