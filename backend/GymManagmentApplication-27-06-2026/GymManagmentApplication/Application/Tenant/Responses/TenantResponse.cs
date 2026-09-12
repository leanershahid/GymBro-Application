namespace GymManagmentApplication.Application.Tenant.Responses;

public class TenantResponse
{
    public ulong Id { get; set; }
    public string Uuid { get; set; } = default!;
    public string Name { get; set; } = default!;
    public string Slug { get; set; } = default!;
    public string Plan { get; set; } = default!;
    public string Status { get; set; } = default!;
    public string? LogoUrl { get; set; }
    public string? PrimaryColor { get; set; }
    public string Timezone { get; set; } = default!;
    public string Locale { get; set; } = default!;
    public string Currency { get; set; } = default!;
    public string? CustomDomain { get; set; }
    public DateTime? TrialEndsAt { get; set; }
    public DateTime CreatedAt { get; set; }
}
