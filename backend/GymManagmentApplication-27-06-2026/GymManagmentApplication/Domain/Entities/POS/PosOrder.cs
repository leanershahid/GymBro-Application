using GymManagmentApplication.Domain.Enums;

namespace GymManagmentApplication.Domain.Entities.POS;

public class PosOrder
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public ulong? BranchId { get; set; }
    public ulong? UserId { get; set; }
    public ulong? ServedBy { get; set; }
    public string OrderNo { get; set; } = default!;
    public decimal Subtotal { get; set; }
    public decimal Tax { get; set; }
    public decimal Discount { get; set; }
    public decimal Total { get; set; }
    public PosPaymentMethod PaymentMethod { get; set; } = PosPaymentMethod.Cash;
    public PosOrderStatus Status { get; set; } = PosOrderStatus.Pending;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Core.Tenant Tenant { get; set; } = default!;
    public ICollection<PosOrderItem> Items { get; set; } = [];
}
