using System.Text.Json;

namespace GymManagmentApplication.Domain.Entities.AI;

public class MlPrediction
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public string EntityType { get; set; } = default!;
    public ulong EntityId { get; set; }
    public string ModelType { get; set; } = default!;
    public decimal Score { get; set; }
    public decimal? Confidence { get; set; }
    public JsonDocument? FeaturesUsed { get; set; }
    public DateTime PredictedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ExpiresAt { get; set; }

    public Core.Tenant Tenant { get; set; } = default!;
}
