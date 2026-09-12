using GymManagmentApplication.Infrastructure.Data;
using GymManagmentApplication.Infrastructure.Repositories.Branch;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Infrastructure.Repositories.Branch;

public class BranchRepository(AppDbContext db) : IBranchRepository
{
    public async Task<List<Domain.Entities.Core.Branch>> GetAllAsync() =>
        await db.Branches.ToListAsync();

    public async Task<List<Domain.Entities.Core.Branch>> GetByTenantAsync(ulong tenantId) =>
        await db.Branches.Where(b => b.TenantId == tenantId).ToListAsync();

    public Task<Domain.Entities.Core.Branch?> GetByIdAsync(ulong id) =>
        db.Branches.FirstOrDefaultAsync(b => b.Id == id);

    public async Task<Domain.Entities.Core.Branch> CreateAsync(Domain.Entities.Core.Branch branch)
    {
        db.Branches.Add(branch);
        await db.SaveChangesAsync();
        return branch;
    }

    public async Task<Domain.Entities.Core.Branch> UpdateAsync(Domain.Entities.Core.Branch branch)
    {
        branch.UpdatedAt = DateTime.UtcNow;
        db.Branches.Update(branch);
        await db.SaveChangesAsync();
        return branch;
    }

    public async Task<bool> DeleteAsync(ulong id)
    {
        var branch = await db.Branches.FindAsync(id);
        if (branch is null) return false;
        db.Branches.Remove(branch);
        await db.SaveChangesAsync();
        return true;
    }
}
