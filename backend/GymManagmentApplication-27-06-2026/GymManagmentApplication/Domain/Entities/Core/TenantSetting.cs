using System.Text.Json;

namespace GymManagmentApplication.Domain.Entities.Core;

public class TenantSetting : BaseEntity
{
    public ulong TenantId { get; set; }
    public string Key { get; set; } = default!;
    public JsonDocument? Value { get; set; }

    public Tenant Tenant { get; set; } = default!;
}
