using System.Text.Json;

namespace GymManagmentApplication.Domain.Entities.Platform;

public class AssessmentTemplate
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public ulong? CreatedBy { get; set; }
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public JsonDocument Fields { get; set; } = default!;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Core.Tenant Tenant { get; set; } = default!;
    public ICollection<ClientAssessment> Assessments { get; set; } = [];
}
