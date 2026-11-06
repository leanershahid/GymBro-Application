using System.Text.Json;
using GymManagmentApplication.Application.Billing.Interfaces;
using GymManagmentApplication.Application.Billing.Requests;
using GymManagmentApplication.Application.Billing.Responses;
using GymManagmentApplication.Domain.Entities.Membership;
using GymManagmentApplication.Domain.Enums;
using GymManagmentApplication.Application.Common;
using Microsoft.EntityFrameworkCore;


namespace GymManagmentApplication.Application.Billing.Services;

public class MembershipPlanService(IAppDbContext db, ICurrentUser currentUser) : IMembershipPlanService
{
    public async Task<List<MembershipPlanResponse>> GetAllAsync(ulong tenantId)
    {
        tenantId = currentUser.ResolveTenantId(tenantId);
        var plans = await db.MembershipPlans
            .Where(p => p.TenantId == tenantId && p.IsActive)
            .OrderBy(p => p.Price).ToListAsync();
        return plans.Select(Map).ToList();
    }

    public async Task<MembershipPlanResponse> CreateAsync(CreateMembershipPlanRequest request)
    {
        request.TenantId = currentUser.ResolveTenantId(request.TenantId);
        await db.EnsureBranchAsync(request.BranchId, request.TenantId);
        var plan = new MembershipPlan
        {
            TenantId = request.TenantId,
            BranchId = request.BranchId is > 0 ? request.BranchId : null,
            Name = request.Name,
            Description = request.Description,
            Price = request.Price,
            // Plans are always priced in the gym's own currency.
            Currency = await db.Tenants.Where(t => t.Id == request.TenantId).Select(t => t.Currency).FirstOrDefaultAsync() ?? "INR",
            BillingCycle = ParseCycle(request.BillingCycle),
            Features = request.Features != null
                ? JsonDocument.Parse(JsonSerializer.Serialize(request.Features))
                : null,
            IsActive = true,
            IsPublic = request.IsPublic,
            IsPopular = request.IsPopular,
            JoiningFee = Money.Round(Math.Max(0, request.JoiningFee)),
            ClassCredits = request.ClassCredits is > 0 ? request.ClassCredits : null,
            PtSessions = request.PtSessions is > 0 ? request.PtSessions : null,
            AccessHours = string.IsNullOrWhiteSpace(request.AccessHours) ? null : request.AccessHours.Trim(),
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
        if (request.BillingCycle is not null) plan.BillingCycle = ParseCycle(request.BillingCycle);
        if (request.IsActive.HasValue) plan.IsActive = request.IsActive.Value;
        if (request.IsPublic.HasValue) plan.IsPublic = request.IsPublic.Value;
        if (request.IsPopular.HasValue) plan.IsPopular = request.IsPopular.Value;
        if (request.JoiningFee.HasValue)
            plan.JoiningFee = request.JoiningFee.Value >= 0 ? Money.Round(request.JoiningFee.Value) : throw new ArgumentException("Joining fee can't be negative.");
        if (request.ClassCredits.HasValue) plan.ClassCredits = request.ClassCredits.Value > 0 ? request.ClassCredits : null;
        if (request.PtSessions.HasValue) plan.PtSessions = request.PtSessions.Value > 0 ? request.PtSessions : null;
        if (request.AccessHours is not null) plan.AccessHours = string.IsNullOrWhiteSpace(request.AccessHours) ? null : request.AccessHours.Trim();
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
            IsPublic = p.IsPublic, IsActive = p.IsActive, CreatedAt = p.CreatedAt,
            IsPopular = p.IsPopular, JoiningFee = p.JoiningFee, ClassCredits = p.ClassCredits, PtSessions = p.PtSessions, AccessHours = p.AccessHours,
        };
    }

    /// <summary>"monthly", "quarterly", "half-yearly", "annual"/"yearly", "weekly", "daily", "one-time".</summary>
    public static BillingCycle ParseCycle(string? value) =>
        (value ?? "monthly").Trim().ToLowerInvariant().Replace("-", "").Replace("_", "").Replace(" ", "") switch
        {
            "annual" or "annually" or "yearly" or "year" => BillingCycle.Yearly,
            "halfyearly" or "halfyear" or "semiannual" => BillingCycle.HalfYearly,
            "quarterly" or "quarter" => BillingCycle.Quarterly,
            "weekly" or "week" => BillingCycle.Weekly,
            "daily" or "day" => BillingCycle.Daily,
            "onetime" or "once" => BillingCycle.OneTime,
            "monthly" or "month" => BillingCycle.Monthly,
            _ => throw new ArgumentException("Billing cycle must be daily, weekly, monthly, quarterly, half-yearly, annual or one-time."),
        };
}
