namespace GymManagmentApplication.Domain.Entities.POS;

public class PosProduct : BaseEntity
{
    public ulong TenantId { get; set; }
    public ulong? BranchId { get; set; }
    public string Name { get; set; } = default!;
    public string? Sku { get; set; }
    public string? Category { get; set; }
    public decimal Price { get; set; }
    public decimal? Cost { get; set; }
    public decimal TaxRate { get; set; }
    public int Stock { get; set; }
    public bool IsActive { get; set; } = true;
    public string? ImageUrl { get; set; }

    public Core.Tenant Tenant { get; set; } = default!;
    public ICollection<PosOrderItem> OrderItems { get; set; } = [];
}
