using GymManagmentApplication.Domain.Enums;

namespace GymManagmentApplication.Domain.Entities.HR;

public class PayrollPeriod
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public DateOnly PeriodStart { get; set; }
    public DateOnly PeriodEnd { get; set; }
    public PayrollStatus Status { get; set; } = PayrollStatus.Draft;
    public DateTime? ProcessedAt { get; set; }

    public Core.Tenant Tenant { get; set; } = default!;
    public ICollection<PayrollSlip> Slips { get; set; } = [];
}
