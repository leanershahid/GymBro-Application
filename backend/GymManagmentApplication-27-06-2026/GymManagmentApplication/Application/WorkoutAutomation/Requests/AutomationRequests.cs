using System.Text.Json;

namespace GymManagmentApplication.Application.WorkoutAutomation.Requests;

public class CreateAutomationRuleRequest
{
    public ulong TenantId { get; set; }
    public string Name { get; set; } = default!;
    public string TriggerEvent { get; set; } = default!;
    public JsonDocument? Conditions { get; set; }
    public JsonDocument Actions { get; set; } = default!;
}

public class UpdateAutomationRuleRequest
{
    public string? Name { get; set; }
    public string? TriggerEvent { get; set; }
    public JsonDocument? Conditions { get; set; }
    public JsonDocument? Actions { get; set; }
    public bool? IsActive { get; set; }
}

public class TriggerAutomationRequest
{
    public ulong RuleId { get; set; }
    public ulong? TargetUserId { get; set; }
    public JsonDocument? Context { get; set; }
}

public class AutomationLogListRequest
{
    public ulong? RuleId { get; set; }
    public int PageNumber { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}
