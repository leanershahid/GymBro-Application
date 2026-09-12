using GymManagmentApplication.Domain.Enums;
using System.Text.Json;

namespace GymManagmentApplication.Domain.Entities.CRM;

public class Lead : BaseEntity
{
    public ulong TenantId { get; set; }
    public ulong? BranchId { get; set; }
    public ulong? AssignedTo { get; set; }
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? Source { get; set; }
    public LeadStatus Status { get; set; } = LeadStatus.New;
    public byte? AiScore { get; set; }
    public decimal? ConversionProb { get; set; }
    public DateTime? LastContactedAt { get; set; }
    public string? Notes { get; set; }
    public JsonDocument? CustomFields { get; set; }

    public Core.Tenant Tenant { get; set; } = default!;
    public Core.Branch? Branch { get; set; }
    public Identity.User? AssignedUser { get; set; }
    public ICollection<LeadActivity> Activities { get; set; } = [];
}
