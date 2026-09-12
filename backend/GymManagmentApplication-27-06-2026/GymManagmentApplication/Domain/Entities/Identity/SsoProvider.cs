using System.Text.Json;

namespace GymManagmentApplication.Domain.Entities.Identity;

public class SsoProvider
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public string Provider { get; set; } = default!;
    public string ClientId { get; set; } = default!;
    public string ClientSecretEnc { get; set; } = default!;
    public JsonDocument? Metadata { get; set; }
    public bool IsActive { get; set; } = true;

    public Core.Tenant Tenant { get; set; } = default!;
}
