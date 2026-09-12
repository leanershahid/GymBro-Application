using System.Text.Json;

namespace GymManagmentApplication.Domain.Entities.Platform;

public class TenantPlugin
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public ulong PluginId { get; set; }
    public bool IsActive { get; set; } = true;
    public JsonDocument? Config { get; set; }
    public DateTime InstalledAt { get; set; } = DateTime.UtcNow;

    public Core.Tenant Tenant { get; set; } = default!;
    public Plugin Plugin { get; set; } = default!;
}
