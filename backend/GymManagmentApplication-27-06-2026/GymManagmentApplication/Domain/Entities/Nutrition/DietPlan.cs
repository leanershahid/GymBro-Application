using GymManagmentApplication.Domain.Enums;
using System.Text.Json;

namespace GymManagmentApplication.Domain.Entities.Nutrition;

public class DietPlan : BaseEntity
{
    public ulong TenantId { get; set; }
    public ulong CreatedBy { get; set; }
    public ulong? ClientId { get; set; }
    public string Name { get; set; } = default!;
    public DietGoal Goal { get; set; } = DietGoal.Health;
    public ushort? CaloriesTarget { get; set; }
    public ushort? ProteinG { get; set; }
    public ushort? CarbsG { get; set; }
    public ushort? FatG { get; set; }
    public bool IsAiGenerated { get; set; }
    public bool IsActive { get; set; } = true;
    public DateOnly? StartsOn { get; set; }
    public DateOnly? EndsOn { get; set; }
    public string? Notes { get; set; }

    public Core.Tenant Tenant { get; set; } = default!;
    public Identity.User Creator { get; set; } = default!;
    public Identity.User? Client { get; set; }
    public ICollection<NutritionLog> NutritionLogs { get; set; } = [];
}
