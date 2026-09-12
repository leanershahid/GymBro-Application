using System.Text.Json;
using GymManagmentApplication.Application.Billing.Interfaces;
using GymManagmentApplication.Application.Billing.Requests;
using GymManagmentApplication.Application.Billing.Responses;
using GymManagmentApplication.Domain.Entities.Membership;
using GymManagmentApplication.Domain.Enums;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Billing.Services;

public class MembershipPlanService(AppDbContext db) : IMembershipPlanService
{
    public async Task<List<MembershipPlanResponse>> GetAllAsync(ulong tenantId)
    {
        var plans = await db.MembershipPlans
            .Where(p => p.TenantId == tenantId && p.IsActive)
            .OrderBy(p => p.Price).ToListAsync();
        return plans.Select(Map).ToList();
    }

    public async Task<MembershipPlanResponse> CreateAsync(CreateMembershipPlanRequest request)
    {
        var plan = new MembershipPlan
        {
            Id = await NextIdAsync(),
            TenantId = request.TenantId,
            Name = request.Name,
            Description = request.Description,
            Price = request.Price,
            Currency = request.Currency,
            BillingCycle = Enum.TryParse<BillingCycle>(request.BillingCycle, true, out var bc) ? bc : BillingCycle.Monthly,
            Features = request.Features != null
                ? JsonDocument.Parse(JsonSerializer.Serialize(request.Features))
                : null,
            IsActive = true
        };
        db.MembershipPlans.Add(plan);
        await db.SaveChangesAsync();
        return Map(plan);
    }

    public async Task<MembershipPlanResponse?> GetByIdAsync(ulong id)
    {
        var plan = await db.MembershipPlans.FindAsync(id);
        return plan is null ? null : Map(plan);
    }

    public async Task<MembershipPlanResponse?> UpdateAsync(ulong id, UpdateMembershipPlanRequest request)
    {
        var plan = await db.MembershipPlans.FindAsync(id);
        if (plan is null) return null;
        if (request.Name is not null) plan.Name = request.Name;
        if (request.Description is not null) plan.Description = request.Description;
        if (request.Price.HasValue) plan.Price = request.Price.Value;
        if (request.BillingCycle is not null &&
            Enum.TryParse<BillingCycle>(request.BillingCycle, true, out var bc))
            plan.BillingCycle = bc;
        if (request.IsActive.HasValue) plan.IsActive = request.IsActive.Value;
        plan.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Map(plan);
    }

    public async Task<bool> ArchiveAsync(ulong id)
    {
        var plan = await db.MembershipPlans.FindAsync(id);
        if (plan is null) return false;
        plan.IsActive = false;
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<List<string>> GetFeaturesAsync(ulong id)
    {
        var plan = await db.MembershipPlans.FindAsync(id);
        if (plan?.Features is null) return [];
        return JsonSerializer.Deserialize<List<string>>(plan.Features.RootElement.GetRawText()) ?? [];
    }

    public async Task<MembershipPlanResponse?> UpdateFeaturesAsync(ulong id, UpdatePlanFeaturesRequest request)
    {
        var plan = await db.MembershipPlans.FindAsync(id);
        if (plan is null) return null;
        plan.Features = JsonDocument.Parse(JsonSerializer.Serialize(request.Features));
        await db.SaveChangesAsync();
        return Map(plan);
    }

    private static MembershipPlanResponse Map(MembershipPlan p)
    {
        List<string> features = [];
        if (p.Features is not null)
            features = JsonSerializer.Deserialize<List<string>>(p.Features.RootElement.GetRawText()) ?? [];

        return new()
        {
            Id = p.Id, TenantId = p.TenantId, Name = p.Name,
            Description = p.Description, Price = p.Price,
            Currency = p.Currency, BillingCycle = p.BillingCycle.ToString(),
            DurationDays = p.BillingCycle switch
            {
                BillingCycle.Daily      => 1,
                BillingCycle.Weekly     => 7,
                BillingCycle.Monthly    => 30,
                BillingCycle.Quarterly  => 90,
                BillingCycle.HalfYearly => 180,
                BillingCycle.Yearly     => 365,
                _                       => 30
            },
            Features = features,
            IsPublic = true, IsActive = p.IsActive, CreatedAt = p.CreatedAt
        };
    }

    private async Task<ulong> NextIdAsync() =>
        (await db.MembershipPlans.MaxAsync(p => (ulong?)p.Id) ?? 0) + 1;
}
