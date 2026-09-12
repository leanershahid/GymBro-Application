using GymManagmentApplication.Domain.Enums;
using System.Text.Json;

namespace GymManagmentApplication.Domain.Entities.HR;

public class PayrollSlip
{
    public ulong Id { get; set; }
    public ulong PeriodId { get; set; }
    public ulong UserId { get; set; }
    public decimal BaseSalary { get; set; }
    public decimal Commission { get; set; }
    public decimal Bonuses { get; set; }
    public decimal Deductions { get; set; }
    public decimal NetPay { get; set; }
    public string Currency { get; set; } = "USD";
    public JsonDocument? Breakdown { get; set; }
    public PayrollSlipStatus Status { get; set; } = PayrollSlipStatus.Draft;
    public DateTime? PaidAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public PayrollPeriod Period { get; set; } = default!;
    public Identity.User User { get; set; } = default!;
}
