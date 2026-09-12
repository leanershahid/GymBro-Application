using GymManagmentApplication.Domain.Enums;
using System.Text.Json;

namespace GymManagmentApplication.Domain.Entities.Core;

public class Branch : BaseEntity
{
    public ulong TenantId { get; set; }
    public ulong? ParentId { get; set; }
    public string Name { get; set; } = default!;
    public string Code { get; set; } = default!;
    public BranchStatus Status { get; set; } = BranchStatus.Active;
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? Country { get; set; }
    public string? Zip { get; set; }
    public decimal? Lat { get; set; }
    public decimal? Lng { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string Timezone { get; set; } = "UTC";
    public ushort? Capacity { get; set; }
    public string? LogoUrl { get; set; }
    public JsonDocument? Meta { get; set; }

    public Tenant Tenant { get; set; } = default!;
    public Branch? Parent { get; set; }
    public ICollection<Branch> Children { get; set; } = [];
}
