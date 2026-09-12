using GymManagmentApplication.Domain.Enums;
using System.Text.Json;

namespace GymManagmentApplication.Domain.Entities.Health;

public class ClientProfile : BaseEntity
{
    public ulong UserId { get; set; }
    public decimal? HeightCm { get; set; }
    public decimal? WeightKg { get; set; }
    public decimal? BodyFatPct { get; set; }
    public decimal? MuscleMassKg { get; set; }
    public FitnessLevel? FitnessLevel { get; set; } = Enums.FitnessLevel.Beginner;
    public JsonDocument? HealthConditions { get; set; }
    public JsonDocument? Allergies { get; set; }
    public JsonDocument? FitnessGoals { get; set; }
    public JsonDocument? EmergencyContact { get; set; }

    public Identity.User User { get; set; } = default!;
}
