using GymManagmentApplication.Domain.Enums;
using System.Text.Json;

namespace GymManagmentApplication.Domain.Entities.Automation;

public class AutomationLog
{
    public ulong Id { get; set; }
    public ulong RuleId { get; set; }
    public string? EntityType { get; set; }
    public ulong? EntityId { get; set; }
    public AutomationLogStatus Status { get; set; }
    public JsonDocument? Result { get; set; }
    public DateTime ExecutedAt { get; set; } = DateTime.UtcNow;

    public AutomationRule Rule { get; set; } = default!;
}
