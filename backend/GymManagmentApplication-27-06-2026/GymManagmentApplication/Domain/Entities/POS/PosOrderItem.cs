namespace GymManagmentApplication.Domain.Entities.POS;

public class PosOrderItem
{
    public ulong Id { get; set; }
    public ulong OrderId { get; set; }
    public ulong ProductId { get; set; }
    public ushort Qty { get; set; } = 1;
    public decimal UnitPrice { get; set; }
    public decimal TaxAmount { get; set; }
    public decimal LineTotal { get; set; }

    public PosOrder Order { get; set; } = default!;
    public PosProduct Product { get; set; } = default!;
}
