namespace GymManagmentApplication.Domain.Entities.Billing;

public class CouponRedemption
{
    public ulong Id { get; set; }
    public ulong CouponId { get; set; }
    public ulong UserId { get; set; }
    public ulong? InvoiceId { get; set; }
    public decimal DiscountApplied { get; set; }
    public DateTime RedeemedAt { get; set; } = DateTime.UtcNow;

    public Coupon Coupon { get; set; } = default!;
    public Identity.User User { get; set; } = default!;
    public Invoice? Invoice { get; set; }
}
