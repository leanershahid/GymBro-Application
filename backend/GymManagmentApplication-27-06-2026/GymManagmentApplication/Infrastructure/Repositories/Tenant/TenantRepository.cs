using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Infrastructure.Repositories.Tenant;

public class TenantRepository(AppDbContext db) : ITenantRepository
{
    public async Task<List<Domain.Entities.Core.Tenant>> GetAllAsync() =>
        await db.Tenants.ToListAsync();

    public Task<Domain.Entities.Core.Tenant?> GetByIdAsync(ulong id) =>
        db.Tenants.FirstOrDefaultAsync(t => t.Id == id);

    public async Task<Domain.Entities.Core.Tenant> CreateAsync(Domain.Entities.Core.Tenant tenant)
    {
        db.Tenants.Add(tenant);
        await db.SaveChangesAsync();
        return tenant;
    }

    public async Task<Domain.Entities.Core.Tenant> UpdateAsync(Domain.Entities.Core.Tenant tenant)
    {
        tenant.UpdatedAt = DateTime.UtcNow;
        db.Tenants.Update(tenant);
        await db.SaveChangesAsync();
        return tenant;
    }

    public async Task<bool> DeleteAsync(ulong id)
    {
        var tenant = await db.Tenants.FindAsync(id);
        if (tenant is null) return false;
        db.Tenants.Remove(tenant);
        await db.SaveChangesAsync();
        return true;
    }
}
