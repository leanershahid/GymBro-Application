using GymManagmentApplication.Application.Branch.Interfaces;
using GymManagmentApplication.Application.Branch.Requests;
using GymManagmentApplication.Application.Branch.Responses;
using GymManagmentApplication.Domain.Enums;
using GymManagmentApplication.Infrastructure.Repositories.Branch;

namespace GymManagmentApplication.Application.Branch.Services;

public class BranchService(IBranchRepository repository) : IBranchService
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
        var branch = new Domain.Entities.Core.Branch
        {
            TenantId = request.TenantId,
            ParentId = request.ParentId == 0 ? null : request.ParentId,
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

    public Task<bool> DeleteAsync(ulong id) => repository.DeleteAsync(id);

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
