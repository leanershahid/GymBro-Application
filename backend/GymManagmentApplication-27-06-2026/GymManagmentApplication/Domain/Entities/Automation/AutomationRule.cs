using GymManagmentApplication.Domain.Enums;
using System.Text.Json;

namespace GymManagmentApplication.Domain.Entities.Automation;

public class AutomationRule : BaseEntity
{
    public ulong TenantId { get; set; }
    public string Name { get; set; } = default!;
    public string TriggerEvent { get; set; } = default!;
    public JsonDocument? TriggerConditions { get; set; }
    public JsonDocument Actions { get; set; } = default!;
    public bool IsActive { get; set; } = true;
    public uint RunCount { get; set; }
    public DateTime? LastRunAt { get; set; }

    public Core.Tenant Tenant { get; set; } = default!;
    public ICollection<AutomationLog> Logs { get; set; } = [];
}
