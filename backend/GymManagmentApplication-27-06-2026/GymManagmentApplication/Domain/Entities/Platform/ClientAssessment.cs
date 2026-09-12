using System.Text.Json;

namespace GymManagmentApplication.Domain.Entities.Platform;

public class ClientAssessment
{
    public ulong Id { get; set; }
    public ulong TemplateId { get; set; }
    public ulong ClientId { get; set; }
    public ulong? AssessedBy { get; set; }
    public JsonDocument Responses { get; set; } = default!;
    public decimal? Score { get; set; }
    public string? Notes { get; set; }
    public DateTime AssessedAt { get; set; } = DateTime.UtcNow;

    public AssessmentTemplate Template { get; set; } = default!;
    public Identity.User Client { get; set; } = default!;
}
