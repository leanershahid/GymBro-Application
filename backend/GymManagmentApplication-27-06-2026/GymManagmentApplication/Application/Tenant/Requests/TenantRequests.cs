using GymManagmentApplication.Domain.Enums;

namespace GymManagmentApplication.Application.Tenant.Requests;

public class CreateTenantRequest
{
    public required string Name { get; set; }
    public required string Slug { get; set; }
    public TenantPlan Plan { get; set; } = TenantPlan.Starter;
    public string? LogoUrl { get; set; }
    public string? PrimaryColor { get; set; }
    public string Timezone { get; set; } = "UTC";
    public string Locale { get; set; } = "en";
    public string Currency { get; set; } = "USD";
    public string? CustomDomain { get; set; }
    public DateTime? TrialEndsAt { get; set; }
}

public class UpdateTenantRequest
{
    public string? Name { get; set; }
    public string? LogoUrl { get; set; }
    public string? PrimaryColor { get; set; }
    public string? Timezone { get; set; }
    public string? Locale { get; set; }
    public string? Currency { get; set; }
    public string? CustomDomain { get; set; }
    public TenantStatus? Status { get; set; }
    public TenantPlan? Plan { get; set; }
    public DateTime? TrialEndsAt { get; set; }
}
