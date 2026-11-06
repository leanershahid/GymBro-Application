using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Domain.Entities.Membership;
using GymManagmentApplication.Domain.Enums;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

using GymManagmentApplication.Application.Corporate.Interfaces;

namespace GymManagmentApplication.Infrastructure.Repositories.Corporate;

public class CorporateRepository(AppDbContext db) : ICorporateRepository
{
    public async Task<(List<CorporateAccount> Items, int Total)> GetAllAsync(int pageNumber, int pageSize)
    {
        var total = await db.CorporateAccounts.CountAsync();
        var items = await db.CorporateAccounts
            .OrderBy(a => a.Name)
            .Page(pageNumber, pageSize)
            .ToListAsync();
        return (items, total);
    }

    public async Task<CorporateAccount> CreateAsync(CorporateAccount account)
    {
        account.CreatedAt = DateTime.UtcNow;
        db.CorporateAccounts.Add(account);
        await db.SaveChangesAsync();
        return account;
    }

    public async Task<CorporateAccount?> GetByIdAsync(ulong id) =>
        await db.CorporateAccounts.FindAsync(id);

    public async Task<CorporateAccount> UpdateAsync(CorporateAccount account)
    {
        account.UpdatedAt = DateTime.UtcNow;
        db.CorporateAccounts.Update(account);
        await db.SaveChangesAsync();
        return account;
    }

    public async Task<List<GymMembership>> GetMembershipsAsync(ulong corporateId) =>
        await db.GymMemberships
            .Include(m => m.Plan)
            .Where(m => m.CorporateId == corporateId && m.Status != MembershipStatus.Cancelled)
            .ToListAsync();

    public async Task<GymMembership> AddMembershipAsync(GymMembership membership)
    {
        membership.CreatedAt = DateTime.UtcNow;
        membership.UpdatedAt = DateTime.UtcNow;
        db.GymMemberships.Add(membership);
        await db.SaveChangesAsync();
        return membership;
    }

    public async Task<bool> RemoveMembershipAsync(ulong corporateId, ulong userId)
    {
        var m = await db.GymMemberships.FirstOrDefaultAsync(x =>
            x.CorporateId == corporateId && x.UserId == userId &&
            x.Status != MembershipStatus.Cancelled);
        if (m is null) return false;
        m.Status      = MembershipStatus.Cancelled;
        m.CancelledAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return true;
    }
}
