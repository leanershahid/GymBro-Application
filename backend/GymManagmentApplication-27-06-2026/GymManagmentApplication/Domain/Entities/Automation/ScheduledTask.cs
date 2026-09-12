using GymManagmentApplication.Domain.Enums;
using System.Text.Json;

namespace GymManagmentApplication.Domain.Entities.Automation;

public class ScheduledTask
{
    public ulong Id { get; set; }
    public ulong? TenantId { get; set; }
    public string TaskType { get; set; } = default!;
    public JsonDocument? Payload { get; set; }
    public DateTime RunAt { get; set; }
    public ScheduledTaskStatus Status { get; set; } = ScheduledTaskStatus.Pending;
    public byte Attempts { get; set; }
    public string? LastError { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
