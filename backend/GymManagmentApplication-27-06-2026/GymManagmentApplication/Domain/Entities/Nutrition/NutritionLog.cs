using GymManagmentApplication.Domain.Enums;

namespace GymManagmentApplication.Domain.Entities.Nutrition;

public class NutritionLog
{
    public ulong Id { get; set; }
    public ulong ClientId { get; set; }
    public ulong? DietPlanId { get; set; }
    public DateOnly LogDate { get; set; }
    public MealType MealType { get; set; }
    public ulong? FoodId { get; set; }
    public string? FoodName { get; set; }
    public decimal? QuantityG { get; set; }
    public ushort? Calories { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Identity.User Client { get; set; } = default!;
    public DietPlan? DietPlan { get; set; }
    public FoodItem? Food { get; set; }
}
