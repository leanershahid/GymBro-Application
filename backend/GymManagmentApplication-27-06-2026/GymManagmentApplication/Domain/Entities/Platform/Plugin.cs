using GymManagmentApplication.Domain.Enums;
using System.Text.Json;

namespace GymManagmentApplication.Domain.Entities.Platform;

public class Plugin
{
    public ulong Id { get; set; }
    public string Slug { get; set; } = default!;
    public string Name { get; set; } = default!;
    public string? Version { get; set; }
    public string? Description { get; set; }
    public string? Author { get; set; }
    public JsonDocument? ConfigSchema { get; set; }
    public PluginMinPlan MinPlan { get; set; } = PluginMinPlan.Pro;

    public ICollection<TenantPlugin> TenantPlugins { get; set; } = [];
}
