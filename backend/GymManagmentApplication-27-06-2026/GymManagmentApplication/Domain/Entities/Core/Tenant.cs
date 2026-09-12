using GymManagmentApplication.Domain.Enums;
using GymManagmentApplication.Domain.Entities.Identity;

namespace GymManagmentApplication.Domain.Entities.Core;

public class Tenant : BaseEntity
{
    public string Uuid { get; set; } = default!;
    public string Name { get; set; } = default!;
    public string Slug { get; set; } = default!;
    public TenantPlan Plan { get; set; } = TenantPlan.Starter;
    public TenantStatus Status { get; set; } = TenantStatus.Trial;
    public string? LogoUrl { get; set; }
    public string? FaviconUrl { get; set; }
    public string? PrimaryColor { get; set; }
    public string Timezone { get; set; } = "UTC";
    public string Locale { get; set; } = "en";
    public string Currency { get; set; } = "USD";
    public string? CustomDomain { get; set; }
    public DateTime? TrialEndsAt { get; set; }

    public ICollection<TenantSetting> Settings { get; set; } = [];
    public ICollection<Branch> Branches { get; set; } = [];
    public ICollection<Role> Roles { get; set; } = [];
    public ICollection<User> Users { get; set; } = [];
}
