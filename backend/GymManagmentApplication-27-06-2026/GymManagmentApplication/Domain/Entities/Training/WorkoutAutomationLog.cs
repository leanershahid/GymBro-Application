using GymManagmentApplication.Domain.Enums;
using System.Text.Json;

namespace GymManagmentApplication.Domain.Entities.Training;

public class WorkoutAutomationLog
{
    public ulong Id { get; set; }
    public ulong RuleId { get; set; }
    public ulong? TargetUserId { get; set; }
    public AutomationLogStatus Status { get; set; }
    public JsonDocument? Result { get; set; }
    public DateTime ExecutedAt { get; set; } = DateTime.UtcNow;

    public WorkoutAutomationRule Rule { get; set; } = default!;
}
