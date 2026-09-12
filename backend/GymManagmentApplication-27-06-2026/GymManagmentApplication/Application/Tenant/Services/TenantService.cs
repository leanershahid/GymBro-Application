using GymManagmentApplication.Application.Tenant.Interfaces;
using GymManagmentApplication.Application.Tenant.Requests;
using GymManagmentApplication.Application.Tenant.Responses;
using GymManagmentApplication.Domain.Enums;
using GymManagmentApplication.Infrastructure.Repositories.Tenant;

namespace GymManagmentApplication.Application.Tenant.Services;

public class TenantService(ITenantRepository repository) : ITenantService
{
    public async Task<List<TenantResponse>> GetAllAsync()
        => (await repository.GetAllAsync()).Select(Map).ToList();

    public async Task<TenantResponse?> GetByIdAsync(ulong id)
    {
        var tenant = await repository.GetByIdAsync(id);
        return tenant is null ? null : Map(tenant);
    }

    public async Task<TenantResponse> CreateAsync(CreateTenantRequest request)
    {
        var tenant = new Domain.Entities.Core.Tenant
        {
            Uuid = Guid.NewGuid().ToString(),
            Name = request.Name,
            Slug = request.Slug,
            Plan = request.Plan,
            Status = TenantStatus.Trial,
            LogoUrl = request.LogoUrl,
            PrimaryColor = request.PrimaryColor,
            Timezone = request.Timezone,
            Locale = request.Locale,
            Currency = request.Currency,
            CustomDomain = request.CustomDomain,
            TrialEndsAt = request.TrialEndsAt
        };
        return Map(await repository.CreateAsync(tenant));
    }

    public async Task<TenantResponse?> UpdateAsync(ulong id, UpdateTenantRequest request)
    {
        var tenant = await repository.GetByIdAsync(id);
        if (tenant is null) return null;
        if (request.Name is not null) tenant.Name = request.Name;
        if (request.LogoUrl is not null) tenant.LogoUrl = request.LogoUrl;
        if (request.PrimaryColor is not null) tenant.PrimaryColor = request.PrimaryColor;
        if (request.Timezone is not null) tenant.Timezone = request.Timezone;
        if (request.Locale is not null) tenant.Locale = request.Locale;
        if (request.Currency is not null) tenant.Currency = request.Currency;
        if (request.CustomDomain is not null) tenant.CustomDomain = request.CustomDomain;
        if (request.Status.HasValue) tenant.Status = request.Status.Value;
        if (request.Plan.HasValue) tenant.Plan = request.Plan.Value;
        if (request.TrialEndsAt.HasValue) tenant.TrialEndsAt = request.TrialEndsAt;
        await repository.UpdateAsync(tenant);
        return Map(tenant);
    }

    public Task<bool> DeleteAsync(ulong id) => repository.DeleteAsync(id);

    private static TenantResponse Map(Domain.Entities.Core.Tenant t) => new()
    {
        Id = t.Id,
        Uuid = t.Uuid,
        Name = t.Name,
        Slug = t.Slug,
        Plan = t.Plan.ToString(),
        Status = t.Status.ToString(),
        LogoUrl = t.LogoUrl,
        PrimaryColor = t.PrimaryColor,
        Timezone = t.Timezone,
        Locale = t.Locale,
        Currency = t.Currency,
        CustomDomain = t.CustomDomain,
        TrialEndsAt = t.TrialEndsAt,
        CreatedAt = t.CreatedAt
    };
}
