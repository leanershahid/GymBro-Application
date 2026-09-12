namespace GymManagmentApplication.Domain.Entities.Platform;

public class TenantFeatureOverride
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public string FeatureKey { get; set; } = default!;
    public bool IsEnabled { get; set; } = true;
    public DateTime? ValidUntil { get; set; }

    public Core.Tenant Tenant { get; set; } = default!;
}
