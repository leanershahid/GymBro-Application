namespace GymManagmentApplication.Application.WorkoutAutomation.Responses;

public class AutomationRuleResponse
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public string Name { get; set; } = default!;
    public string TriggerEvent { get; set; } = default!;
    public bool IsActive { get; set; }
    public uint RunCount { get; set; }
    public DateTime? LastRunAt { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class AutomationLogResponse
{
    public ulong Id { get; set; }
    public ulong RuleId { get; set; }
    public string RuleName { get; set; } = default!;
    public ulong? TargetUserId { get; set; }
    public string Status { get; set; } = default!;
    public DateTime ExecutedAt { get; set; }
}

public class TriggerResultResponse
{
    public ulong RuleId { get; set; }
    public string Status { get; set; } = default!;
    public string Message { get; set; } = default!;
    public DateTime TriggeredAt { get; set; }
}
