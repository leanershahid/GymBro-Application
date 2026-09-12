using GymManagmentApplication.Domain.Enums;
using System.Text.Json;

namespace GymManagmentApplication.Domain.Entities.HR;

public class PayrollConfig : BaseEntity
{
    public ulong TenantId { get; set; }
    public ulong UserId { get; set; }
    public decimal BaseSalary { get; set; }
    public string Currency { get; set; } = "USD";
    public JsonDocument? CommissionRules { get; set; }
    public PayCycle PayCycle { get; set; } = PayCycle.Monthly;
    public bool IsActive { get; set; } = true;

    public Core.Tenant Tenant { get; set; } = default!;
    public Identity.User User { get; set; } = default!;
}
