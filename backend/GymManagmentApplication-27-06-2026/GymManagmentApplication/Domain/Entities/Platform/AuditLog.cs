using System.Text.Json;

namespace GymManagmentApplication.Domain.Entities.Platform;

public class AuditLog
{
    public ulong Id { get; set; }
    public ulong? TenantId { get; set; }
    public ulong? UserId { get; set; }
    public string Action { get; set; } = default!;
    public string EntityType { get; set; } = default!;
    public ulong? EntityId { get; set; }
    public JsonDocument? OldValues { get; set; }
    public JsonDocument? NewValues { get; set; }
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
