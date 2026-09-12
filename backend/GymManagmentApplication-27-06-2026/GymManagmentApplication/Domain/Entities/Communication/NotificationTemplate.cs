using GymManagmentApplication.Domain.Enums;
using System.Text.Json;

namespace GymManagmentApplication.Domain.Entities.Communication;

public class NotificationTemplate
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public string Name { get; set; } = default!;
    public NotificationChannel Channel { get; set; }
    public string EventType { get; set; } = default!;
    public string? Subject { get; set; }
    public string Body { get; set; } = default!;
    public JsonDocument? Variables { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Core.Tenant Tenant { get; set; } = default!;
}
