namespace GymManagmentApplication.Domain.Entities.Nutrition;

public class FoodItem
{
    public ulong Id { get; set; }
    public ulong? TenantId { get; set; }
    public string Name { get; set; } = default!;
    public string? Brand { get; set; }
    public ushort? Calories { get; set; }
    public decimal? ProteinG { get; set; }
    public decimal? CarbsG { get; set; }
    public decimal? FatG { get; set; }
    public decimal? FiberG { get; set; }
    public decimal? ServingG { get; set; }
    public string? Barcode { get; set; }
}
