using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Common;

/// <summary>
/// Cross-entity consistency checks: a record may only point at branches, members and plans
/// of its own gym. Throws <see cref="ArgumentException"/> (→ 400) on a mismatch.
/// IgnoreQueryFilters is used so a super admin acting on another tenant is still checked
/// against that tenant rather than silently passing.
/// </summary>
public static class TenantGuard
{
    public static async Task EnsureBranchAsync(this AppDbContext db, ulong? branchId, ulong tenantId)
    {
        if (branchId is not { } id || id == 0) return;
        if (!await db.Branches.IgnoreQueryFilters().AnyAsync(b => b.Id == id && b.TenantId == tenantId))
            throw new ArgumentException($"Branch {id} does not belong to this gym.");
    }

    public static async Task EnsureUserAsync(this AppDbContext db, ulong userId, ulong tenantId, string label = "Member")
    {
        if (!await db.Users.IgnoreQueryFilters().AnyAsync(u => u.Id == userId && u.TenantId == tenantId && u.DeletedAt == null))
            throw new ArgumentException($"{label} {userId} does not belong to this gym.");
    }

    public static async Task EnsureMembershipPlanAsync(this AppDbContext db, ulong planId, ulong tenantId)
    {
        if (!await db.MembershipPlans.IgnoreQueryFilters().AnyAsync(p => p.Id == planId && p.TenantId == tenantId))
            throw new ArgumentException($"Membership plan {planId} does not belong to this gym.");
    }
}
