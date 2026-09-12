using System.Text.Json;

namespace GymManagmentApplication.Domain.Entities.Platform;

public class ApiKey
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public ulong? UserId { get; set; }
    public string Name { get; set; } = default!;
    public string KeyHash { get; set; } = default!;
    public string KeyPrefix { get; set; } = default!;
    public JsonDocument? Scopes { get; set; }
    public uint RateLimit { get; set; } = 1000;
    public DateTime? LastUsedAt { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Core.Tenant Tenant { get; set; } = default!;
}
