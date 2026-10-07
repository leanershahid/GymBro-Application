namespace GymManagmentApplication.Domain.Entities.Health;

public class WearableDevice
{
    public ulong Id { get; set; }
    /// <summary>Owning gym (nullable: rows written before this was mapped have none).</summary>
    public ulong? TenantId { get; set; }
    public ulong ClientId { get; set; }
    public string Provider { get; set; } = default!;
    public string? DeviceName { get; set; }
    public string? AccessTokenEnc { get; set; }
    public string? RefreshTokenEnc { get; set; }
    public DateTime? TokenExpiresAt { get; set; }
    public DateTime? LastSyncedAt { get; set; }
    public bool IsActive { get; set; } = true;

    public Identity.User Client { get; set; } = default!;
}
