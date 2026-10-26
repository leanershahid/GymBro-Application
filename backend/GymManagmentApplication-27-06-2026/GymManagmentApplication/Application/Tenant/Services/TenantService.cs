using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Tenant.Interfaces;
using GymManagmentApplication.Application.Tenant.Requests;
using GymManagmentApplication.Application.Tenant.Responses;
using GymManagmentApplication.Domain.Enums;
using GymManagmentApplication.Infrastructure.Data;
using GymManagmentApplication.Infrastructure.Repositories.Tenant;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Tenant.Services;

public class TenantService(ITenantRepository repository, ICurrentUser currentUser, AppDbContext db) : ITenantService
{
    // Super admins see every gym; a tenant admin sees only their own.
    public async Task<List<TenantResponse>> GetAllAsync()
        => (await repository.GetAllAsync())
            .Where(t => currentUser.IsSuperAdmin || t.Id == currentUser.TenantId)
            .Select(Map).ToList();

    public async Task<TenantResponse?> GetByIdAsync(ulong id)
    {
        if (!CanAccess(id)) return null;
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
        if (await db.Tenants.AnyAsync(t => t.Slug == request.Slug))
            throw new ArgumentException($"A gym with slug '{request.Slug}' already exists.");

        var created = await repository.CreateAsync(tenant);
        // A gym is unusable until it has its own admin/trainer/client/staff roles.
        await DbSeeder.EnsureSystemRolesAsync(db, created.Id, includeSuperAdmin: false);
        return Map(created);
    }

    public async Task<TenantResponse?> UpdateAsync(ulong id, UpdateTenantRequest request)
    {
        if (!CanAccess(id)) return null;
        var tenant = await repository.GetByIdAsync(id);
        if (tenant is null) return null;
        if (request.Name is not null) tenant.Name = request.Name;
        if (request.LogoUrl is not null) tenant.LogoUrl = request.LogoUrl;
        if (request.PrimaryColor is not null) tenant.PrimaryColor = request.PrimaryColor;
        if (request.Timezone is not null) tenant.Timezone = request.Timezone;
        if (request.Locale is not null) tenant.Locale = request.Locale;
        if (request.Currency is not null) tenant.Currency = request.Currency;
        if (request.CustomDomain is not null) tenant.CustomDomain = request.CustomDomain;
        // Status, plan and trial are commercial settings — platform-level only.
        if (currentUser.IsSuperAdmin)
        {
            if (request.Status.HasValue) tenant.Status = request.Status.Value;
            if (request.Plan.HasValue) tenant.Plan = request.Plan.Value;
            if (request.TrialEndsAt.HasValue) tenant.TrialEndsAt = request.TrialEndsAt;
        }
        await repository.UpdateAsync(tenant);
        return Map(tenant);
    }

    /// <summary>
    /// Hard-deletes a gym only while it is still empty. A gym with members or financial
    /// history must be closed by setting Status = Cancelled instead, which keeps its records.
    /// </summary>
    public async Task<bool> DeleteAsync(ulong id)
    {
        var platformTenantId = await db.Tenants.OrderBy(t => t.Id).Select(t => t.Id).FirstAsync();
        if (id == platformTenantId)
            throw new ArgumentException("The platform tenant cannot be deleted.");

        var inUse =
            await db.Users.IgnoreQueryFilters().AnyAsync(u => u.TenantId == id) ||
            await db.Payments.IgnoreQueryFilters().AnyAsync(p => p.TenantId == id) ||
            await db.Invoices.IgnoreQueryFilters().AnyAsync(i => i.TenantId == id) ||
            await db.Leads.IgnoreQueryFilters().AnyAsync(l => l.TenantId == id) ||
            await db.GymMemberships.IgnoreQueryFilters().AnyAsync(m => m.TenantId == id);
        if (inUse)
            throw new ArgumentException(
                "This gym still has users or billing records. Set its status to Cancelled instead of deleting it.");

        // Remove restrict-FK config rows that an empty gym may still own.
        db.ModuleAccesses.RemoveRange(db.ModuleAccesses.IgnoreQueryFilters().Where(m => m.TenantId == id));
        await db.SaveChangesAsync();

        return await repository.DeleteAsync(id);
    }

    private bool CanAccess(ulong tenantId) => currentUser.IsSuperAdmin || currentUser.TenantId == tenantId;

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
