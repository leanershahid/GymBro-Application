using GymManagmentApplication.Application.Branch.Interfaces;
using GymManagmentApplication.Application.Branch.Requests;
using GymManagmentApplication.Application.Branch.Responses;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Domain.Enums;
using GymManagmentApplication.Infrastructure.Data;
using GymManagmentApplication.Infrastructure.Repositories.Branch;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Branch.Services;

public class BranchService(IBranchRepository repository, ICurrentUser currentUser, AppDbContext db) : IBranchService
{
    public async Task<List<BranchResponse>> GetAllAsync()
        => (await repository.GetAllAsync()).Select(Map).ToList();

    public async Task<List<BranchResponse>> GetByTenantAsync(ulong tenantId)
        => (await repository.GetByTenantAsync(tenantId)).Select(Map).ToList();

    public async Task<BranchResponse?> GetByIdAsync(ulong id)
    {
        var branch = await repository.GetByIdAsync(id);
        return branch is null ? null : Map(branch);
    }

    public async Task<BranchResponse> CreateAsync(CreateBranchRequest request)
    {
        // Tenant comes from the caller's token; only a super admin may create for another gym.
        var tenantId = currentUser.ResolveTenantId(request.TenantId);
        var parentId = request.ParentId == 0 ? null : request.ParentId;

        if (!await db.Tenants.AnyAsync(t => t.Id == tenantId))
            throw new ArgumentException($"Tenant {tenantId} does not exist.");
        if (parentId is { } pid &&
            !await db.Branches.IgnoreQueryFilters().AnyAsync(b => b.Id == pid && b.TenantId == tenantId))
            throw new ArgumentException($"Parent branch {pid} does not belong to this gym.");
        if (await db.Branches.IgnoreQueryFilters().AnyAsync(b => b.TenantId == tenantId && b.Code == request.Code))
            throw new ArgumentException($"Branch code '{request.Code}' is already used in this gym.");

        var branch = new Domain.Entities.Core.Branch
        {
            TenantId = tenantId,
            ParentId = parentId,
            Name = request.Name,
            Code = request.Code,
            Status = BranchStatus.Active,
            Address = request.Address,
            City = request.City,
            State = request.State,
            Country = request.Country,
            Zip = request.Zip,
            Phone = request.Phone,
            Email = request.Email,
            Timezone = request.Timezone,
            Capacity = request.Capacity,
            LogoUrl = request.LogoUrl
        };
        return Map(await repository.CreateAsync(branch));
    }

    public async Task<BranchResponse?> UpdateAsync(ulong id, UpdateBranchRequest request)
    {
        var branch = await repository.GetByIdAsync(id);
        if (branch is null) return null;

        // Deactivating a branch while it still has members/trainers would strand them —
        // the admin must transfer them to another branch first (see TransferAsync).
        if (request.Status.HasValue && request.Status.Value != BranchStatus.Active && branch.Status != request.Status.Value)
        {
            var stillAssigned = await db.Users.CountAsync(u => u.BranchId == id && u.DeletedAt == null)
                               + await db.TrainerProfiles.CountAsync(t => t.BranchId == id);
            if (stillAssigned > 0)
                throw new ArgumentException(
                    $"This branch still has {stillAssigned} member(s)/trainer(s). Transfer them to another branch before deactivating it.");
        }

        if (request.Name is not null) branch.Name = request.Name;
        if (request.Address is not null) branch.Address = request.Address;
        if (request.City is not null) branch.City = request.City;
        if (request.State is not null) branch.State = request.State;
        if (request.Country is not null) branch.Country = request.Country;
        if (request.Zip is not null) branch.Zip = request.Zip;
        if (request.Phone is not null) branch.Phone = request.Phone;
        if (request.Email is not null) branch.Email = request.Email;
        if (request.Timezone is not null) branch.Timezone = request.Timezone;
        if (request.Capacity.HasValue) branch.Capacity = request.Capacity;
        if (request.LogoUrl is not null) branch.LogoUrl = request.LogoUrl;
        if (request.Status.HasValue) branch.Status = request.Status.Value;
        await repository.UpdateAsync(branch);
        return Map(branch);
    }

    /// <summary>
    /// Deletes a branch only when nothing references it. Some branch FKs are NO ACTION
    /// (users, trainers, leads, plans) and others CASCADE (classes, attendance, lockers…),
    /// so a blind delete would either fail or silently wipe history. Deactivate instead.
    /// </summary>
    public async Task<bool> DeleteAsync(ulong id)
    {
        var branch = await repository.GetByIdAsync(id); // tenant-filtered
        if (branch is null) return false;

        var usage = new (string Label, int Count)[]
        {
            ("sub-branches",        await db.Branches.CountAsync(b => b.ParentId == id)),
            ("users",               await db.Users.CountAsync(u => u.BranchId == id && u.DeletedAt == null)),
            ("trainers",            await db.TrainerProfiles.CountAsync(t => t.BranchId == id)),
            ("trainer assignments", await db.TrainerClientAssignments.CountAsync(a => a.BranchId == id)),
            ("leads",               await db.Leads.CountAsync(l => l.BranchId == id)),
            ("membership plans",    await db.MembershipPlans.CountAsync(p => p.BranchId == id)),
            ("memberships",         await db.GymMemberships.CountAsync(m => m.BranchId == id)),
            ("classes",             await db.GymClasses.CountAsync(c => c.BranchId == id)),
            ("attendance records",  await db.Attendances.CountAsync(a => a.BranchId == id)),
            ("lockers",             await db.Lockers.CountAsync(l => l.BranchId == id)),
            ("access devices",      await db.AccessDevices.CountAsync(d => d.BranchId == id)),
            ("equipment",           await db.FacilityEquipments.CountAsync(e => e.BranchId == id)),
        }.Where(x => x.Count > 0).ToList();

        if (usage.Count > 0)
            throw new ArgumentException(
                "Branch is still in use (" + string.Join(", ", usage.Select(u => $"{u.Count} {u.Label}")) +
                "). Set its status to Inactive instead of deleting it.");

        return await repository.DeleteAsync(id);
    }

    /// <summary>Moves every member and trainer (and their open assignments) from one branch to another.</summary>
    public async Task<int> TransferAsync(ulong id, ulong targetBranchId)
    {
        if (id == targetBranchId)
            throw new ArgumentException("Choose a different branch to transfer to.");

        var branch = await repository.GetByIdAsync(id)
            ?? throw new ArgumentException($"Branch {id} not found.");
        var target = await repository.GetByIdAsync(targetBranchId)
            ?? throw new ArgumentException($"Target branch {targetBranchId} not found.");
        if (target.Status != BranchStatus.Active)
            throw new ArgumentException("The target branch must be active.");

        var users = await db.Users.Where(u => u.BranchId == id && u.DeletedAt == null).ToListAsync();
        foreach (var u in users) u.BranchId = targetBranchId;

        var trainers = await db.TrainerProfiles.Where(t => t.BranchId == id).ToListAsync();
        foreach (var t in trainers) t.BranchId = targetBranchId;

        var assignments = await db.TrainerClientAssignments.Where(a => a.BranchId == id).ToListAsync();
        foreach (var a in assignments) a.BranchId = targetBranchId;

        await db.SaveChangesAsync();
        return users.Count + trainers.Count;
    }

    private static BranchResponse Map(Domain.Entities.Core.Branch b) => new()
    {
        Id = b.Id,
        TenantId = b.TenantId,
        ParentId = b.ParentId,
        Name = b.Name,
        Code = b.Code,
        Status = b.Status.ToString(),
        Address = b.Address,
        City = b.City,
        State = b.State,
        Country = b.Country,
        Zip = b.Zip,
        Phone = b.Phone,
        Email = b.Email,
        Timezone = b.Timezone,
        Capacity = b.Capacity,
        LogoUrl = b.LogoUrl,
        CreatedAt = b.CreatedAt
    };
}
