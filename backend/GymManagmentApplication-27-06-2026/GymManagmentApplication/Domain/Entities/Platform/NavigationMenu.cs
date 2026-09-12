using System.Text.Json;

namespace GymManagmentApplication.Domain.Entities.Platform;

public class NavigationMenu
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public string Name { get; set; } = default!;
    public string Location { get; set; } = "main";
    public JsonDocument Items { get; set; } = default!;
    public JsonDocument? RoleIds { get; set; }
    public bool IsActive { get; set; } = true;

    public Core.Tenant Tenant { get; set; } = default!;
}
