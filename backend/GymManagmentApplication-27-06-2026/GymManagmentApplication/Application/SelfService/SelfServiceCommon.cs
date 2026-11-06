using System.Text.Json;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Domain.Constants;
using GymManagmentApplication.Domain.Entities.Membership;
using GymManagmentApplication.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.SelfService;

/// <summary>Helpers shared by the plan / checkout and request services.</summary>
public static class SelfServiceCommon
{
    /// <summary>Admin module that owns the staff queue (ModuleCatalog).</summary>
    public const string QueueModuleKey = "admin.membership-requests";

    /// <summary>Who hears about new requests / desk payments: the gym's admins plus roles granted the queue module.</summary>
    public static async Task<List<ulong>> StaffRecipientsAsync(IAppDbContext db, ulong tenantId)
    {
        var admins = await (from u in db.Users.IgnoreQueryFilters()
                            join role in db.Roles.IgnoreQueryFilters() on u.RoleId equals role.Id
                            where u.TenantId == tenantId && u.DeletedAt == null && role.Slug == RoleNames.Admin
                            select u.Id).ToListAsync();
        var grantedRoles = await (from g in db.RoleModuleGrants.IgnoreQueryFilters()
                                  join m in db.Modules on g.ModuleId equals m.Id
                                  where g.TenantId == tenantId && g.CanView && m.Key == QueueModuleKey
                                  select g.RoleId).ToListAsync();
        var granted = grantedRoles.Count == 0 ? [] : await db.Users.IgnoreQueryFilters()
            .Where(u => u.TenantId == tenantId && u.DeletedAt == null && grantedRoles.Contains(u.RoleId))
            .Select(u => u.Id).ToListAsync();
        return admins.Concat(granted).Distinct().ToList();
    }

    public static List<string> Features(MembershipPlan p)
    {
        if (p.Features is null) return [];
        try { return JsonSerializer.Deserialize<List<string>>(p.Features.RootElement.GetRawText()) ?? []; }
        catch (JsonException) { return []; }
    }

    public static PublicPlanResponse MapPlan(MembershipPlan p, string? branchName = null) => new()
    {
        Id = p.Id, Name = p.Name, Description = p.Description, Price = p.Price, Currency = p.Currency,
        BillingCycle = p.BillingCycle.ToString(), DurationDays = Billing.Services.SubscriptionService.CycleToDays(p.BillingCycle),
        JoiningFee = p.JoiningFee, ClassCredits = p.ClassCredits, PtSessions = p.PtSessions, AccessHours = p.AccessHours,
        BranchId = p.BranchId, BranchName = branchName, Features = Features(p), IsPopular = p.IsPopular, TrialDays = p.TrialDays,
    };

    public static string Name(Domain.Entities.Identity.User? u) =>
        u is null ? "A member" : $"{u.FirstName} {u.LastName}".Trim() is { Length: > 0 } n ? n : "A member";

    /// <summary>The member's live membership (active / trial / paused), newest first; null when none.</summary>
    public static Task<GymMembership?> LiveMembershipAsync(IAppDbContext db, ulong userId) =>
        db.GymMemberships.Include(m => m.Plan).Include(m => m.User)
            .Where(m => m.UserId == userId && (m.Status == MembershipStatus.Active || m.Status == MembershipStatus.Trial || m.Status == MembershipStatus.Paused))
            .OrderByDescending(m => m.StartsAt).ThenByDescending(m => m.CreatedAt)
            .FirstOrDefaultAsync();

    public static string Money(decimal amount, string currency) => CouponRules.Format(amount, currency);
}
