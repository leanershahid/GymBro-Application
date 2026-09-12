using GymManagmentApplication.Domain.Enums;

namespace GymManagmentApplication.Domain.Entities.Billing;

public class Coupon : BaseEntity
{
    public ulong TenantId { get; set; }
    public string Code { get; set; } = default!;
    public string? Description { get; set; }
    public CouponType Type { get; set; } = CouponType.Percentage;
    public decimal Value { get; set; }
    public string? Currency { get; set; }
    public decimal MinOrder { get; set; }
    public decimal? MaxDiscount { get; set; }
    public uint? MaxUses { get; set; }
    public uint UsesCount { get; set; }
    public byte PerUserLimit { get; set; } = 1;
    public DateTime? ValidFrom { get; set; }
    public DateTime? ValidUntil { get; set; }
    public System.Text.Json.JsonDocument? ApplicableTo { get; set; }
    public bool IsActive { get; set; } = true;

    public Core.Tenant Tenant { get; set; } = default!;
    public ICollection<CouponRedemption> Redemptions { get; set; } = [];
}
