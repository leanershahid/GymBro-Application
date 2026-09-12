using System.Text.Json;

namespace GymManagmentApplication.Domain.Entities.Communication;

public class FeedbackSurvey
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public string Name { get; set; } = default!;
    public Enums.SurveyType Type { get; set; } = Enums.SurveyType.Nps;
    public JsonDocument Questions { get; set; } = default!;
    public string? TriggerEvent { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Core.Tenant Tenant { get; set; } = default!;
    public ICollection<FeedbackResponse> Responses { get; set; } = [];
}
